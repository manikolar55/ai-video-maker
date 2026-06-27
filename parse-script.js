require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

const INPUT_SCRIPT  = path.join(__dirname, 'input', 'script.txt');
const INPUT_AUDIO   = path.join(__dirname, 'input', 'voiceover.mp3');
const OUTPUT_STORYBOARD = path.join(__dirname, 'output', 'storyboard.json');

const PROVIDER     = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const API_KEY      = process.env.ANTHROPIC_API_KEY || '';
const RELAY_URL    = process.env.RELAY_URL || '';

// ── FFmpeg check ──────────────────────────────────────────────────────────────

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) reject(new Error('FFmpeg not found. Install: winget install ffmpeg'));
      else resolve();
    });
  });
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`Cannot read audio: ${err.message}`));
      const dur = metadata.format.duration;
      if (!dur) return reject(new Error('Cannot determine audio duration'));
      resolve(parseFloat(parseFloat(dur).toFixed(2)));
    });
  });
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(script, audioDuration) {
  return `Break this script into scenes for a video. All scene durations MUST sum to exactly ${audioDuration} seconds.

Return ONLY a valid JSON object in this exact structure — no markdown, no explanation:
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
}

// ── Ollama provider ───────────────────────────────────────────────────────────

async function checkOllama() {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
  } catch {
    throw new Error(
      `Cannot reach Ollama at ${OLLAMA_URL}\n` +
      'Make sure Ollama is running: ollama serve'
    );
  }
}

async function callOllama(script, audioDuration) {
  await checkOllama();
  console.log(`  Provider: Ollama (${OLLAMA_MODEL} at ${OLLAMA_URL})`);

  const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: 'You are a video storyboard director. Return only valid raw JSON, no markdown, no explanation.' },
      { role: 'user',   content: buildPrompt(script, audioDuration) },
    ],
    stream: false,
  }, { timeout: 120000 });

  return response.data.message.content.trim();
}

// ── Anthropic provider ────────────────────────────────────────────────────────

async function callAnthropic(script, audioDuration) {
  if (!API_KEY || API_KEY === 'your_anthropic_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY is not set. Go to Settings and enter your API key.');
  }
  if (!RELAY_URL || RELAY_URL === 'your_cloudflare_worker_url_here') {
    throw new Error('RELAY_URL is not set. Go to Settings and enter your Cloudflare Worker URL.');
  }

  console.log(`  Provider: Anthropic (claude-opus-4-7 via relay)`);

  const response = await axios.post(RELAY_URL, {
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: 'You are a video storyboard director. Return only valid raw JSON, no markdown.',
    messages: [{ role: 'user', content: buildPrompt(script, audioDuration) }],
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    timeout: 60000,
  });

  return response.data.content[0].text.trim();
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error(`Invalid JSON returned by AI:\n${raw.substring(0, 400)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function parseScript() {
  if (!fs.existsSync(INPUT_SCRIPT)) throw new Error(`Script not found: ${INPUT_SCRIPT}`);
  if (!fs.existsSync(INPUT_AUDIO))  throw new Error(`Voiceover not found: ${INPUT_AUDIO}\nRun generate-voice.js first.`);

  await checkFFmpeg();

  const script = fs.readFileSync(INPUT_SCRIPT, 'utf-8').trim();
  console.log('  Measuring audio duration...');
  const audioDuration = await getAudioDuration(INPUT_AUDIO);
  console.log(`  Audio duration: ${audioDuration}s`);

  const rawText = PROVIDER === 'anthropic'
    ? await callAnthropic(script, audioDuration)
    : await callOllama(script, audioDuration);

  const storyboard = parseJSON(rawText);

  if (!storyboard.scenes || !Array.isArray(storyboard.scenes)) {
    throw new Error('Storyboard is missing scenes array');
  }

  const actualTotal = storyboard.scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
  if (Math.abs(actualTotal - audioDuration) > 0.5) {
    console.warn(`  Warning: scene durations sum to ${actualTotal.toFixed(2)}s — adjusting to ${audioDuration}s`);
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
