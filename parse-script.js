require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

const INPUT_SCRIPT = path.join(__dirname, 'input', 'script.txt');
const INPUT_AUDIO = path.join(__dirname, 'input', 'voiceover.mp3');
const OUTPUT_STORYBOARD = path.join(__dirname, 'output', 'storyboard.json');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        reject(new Error(
          'FFmpeg not found in PATH.\n' +
          'Install: winget install ffmpeg  (then reopen terminal)'
        ));
      } else {
        resolve();
      }
    });
  });
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`Cannot read audio: ${err.message}`));
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error('Cannot determine audio duration'));
      resolve(parseFloat(parseFloat(duration).toFixed(2)));
    });
  });
}

async function checkOllama() {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
  } catch {
    throw new Error(
      `Cannot reach Ollama at ${OLLAMA_URL}\n` +
      'Make sure Ollama is running: open a terminal and run "ollama serve"\n' +
      'Install Ollama from https://ollama.com if needed.'
    );
  }
}

async function parseScript() {
  if (!fs.existsSync(INPUT_SCRIPT)) {
    throw new Error(`Script not found: ${INPUT_SCRIPT}`);
  }
  if (!fs.existsSync(INPUT_AUDIO)) {
    throw new Error(`Voiceover not found: ${INPUT_AUDIO}\nRun generate-voice.js first.`);
  }

  await checkFFmpeg();
  await checkOllama();

  const script = fs.readFileSync(INPUT_SCRIPT, 'utf-8').trim();
  console.log(`  Using model: ${OLLAMA_MODEL} at ${OLLAMA_URL}`);

  console.log('  Measuring audio duration...');
  const audioDuration = await getAudioDuration(INPUT_AUDIO);
  console.log(`  Audio duration: ${audioDuration}s`);

  console.log(`  Sending script to Ollama (${OLLAMA_MODEL})...`);

  const prompt = `You are a video storyboard director. Return ONLY valid raw JSON with no markdown, no explanation.

Break this script into scenes for a video. All scene durations MUST sum to exactly ${audioDuration} seconds.

Return this exact JSON structure:
{
  "totalDuration": ${audioDuration},
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title",
      "duration": 5.0,
      "voiceover": "narration text for this scene",
      "visualDescription": "what appears visually",
      "onScreenText": "SHORT PUNCHY TEXT",
      "backgroundColor": "#1a1a2e",
      "transition": "fade"
    }
  ]
}

Rules:
- transition must be: cut, fade, or dissolve
- backgroundColor must be a valid hex color
- durations must sum exactly to ${audioDuration}
- onScreenText max 5 words, uppercase, impactful
- Return ONLY the JSON object, nothing else

Script:
${script}`;

  const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a video storyboard director. Return only valid raw JSON, no markdown, no explanation.',
      },
      { role: 'user', content: prompt },
    ],
    stream: false,
  }, { timeout: 120000 });

  const rawText = response.data.message.content.trim();

  let storyboard;
  try {
    storyboard = JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        storyboard = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error(`Ollama returned invalid JSON.\nRaw response:\n${rawText.substring(0, 500)}`);
      }
    } else {
      throw new Error(`No JSON found in Ollama response:\n${rawText.substring(0, 500)}`);
    }
  }

  if (!storyboard.scenes || !Array.isArray(storyboard.scenes)) {
    throw new Error('Storyboard missing scenes array');
  }

  const actualTotal = storyboard.scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
  if (Math.abs(actualTotal - audioDuration) > 0.5) {
    console.warn(`  Warning: durations sum to ${actualTotal.toFixed(2)}s, adjusting to match ${audioDuration}s`);
    const diff = audioDuration - actualTotal;
    storyboard.scenes[storyboard.scenes.length - 1].duration = parseFloat(
      (storyboard.scenes[storyboard.scenes.length - 1].duration + diff).toFixed(2)
    );
  }
  storyboard.totalDuration = audioDuration;

  if (!fs.existsSync(path.join(__dirname, 'output'))) {
    fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  }

  fs.writeFileSync(OUTPUT_STORYBOARD, JSON.stringify(storyboard, null, 2));
  console.log(`  Storyboard saved: ${storyboard.scenes.length} scenes`);
}

parseScript().catch((err) => {
  console.error('parse-script error:', err.message);
  process.exit(1);
});
