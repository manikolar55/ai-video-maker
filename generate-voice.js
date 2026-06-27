require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INPUT_SCRIPT = path.join(__dirname, 'input', 'script.txt');
const OUTPUT_AUDIO = path.join(__dirname, 'input', 'voiceover.mp3');

const VOICE = process.env.TTS_VOICE || 'en-US-AriaNeural';
const RATE = process.env.TTS_RATE || '+0%';

async function generateVoiceEdgeTTS(text) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, RATE);
  const { audioStream } = await tts.toStream(text);
  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', () => {
      fs.writeFileSync(OUTPUT_AUDIO, Buffer.concat(chunks));
      resolve();
    });
    audioStream.on('error', reject);
  });
}

function generateVoiceSAPI(text) {
  const wavPath = path.join(__dirname, 'input', 'voiceover_temp.wav');
  const safeText = text.replace(/'/g, "''").replace(/"/g, '`"');
  const ps = `
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $s.Rate = 1
    $s.SetOutputToWaveFile('${wavPath.replace(/\\/g, '\\\\')}')
    $s.Speak('${safeText.substring(0, 3000)}')
    $s.Dispose()
  `;
  execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
  execSync(`ffmpeg -y -i "${wavPath}" -codec:a libmp3lame -qscale:a 2 "${OUTPUT_AUDIO}"`, { stdio: 'pipe' });
  if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
}

async function generateVoice() {
  if (!fs.existsSync(INPUT_SCRIPT)) {
    throw new Error(`Script not found: ${INPUT_SCRIPT}`);
  }

  const text = fs.readFileSync(INPUT_SCRIPT, 'utf-8').trim();
  if (!text) throw new Error('script.txt is empty');

  console.log(`  Voice: ${VOICE} | Rate: ${RATE}`);
  console.log(`  Generating voiceover from script (${text.length} chars)...`);

  try {
    await generateVoiceEdgeTTS(text);
    console.log(`  Voiceover saved using Microsoft Edge TTS`);
  } catch (edgeErr) {
    console.warn(`  Edge TTS failed (${edgeErr.message}) — falling back to Windows SAPI`);
    try {
      generateVoiceSAPI(text);
      console.log(`  Voiceover saved using Windows built-in TTS`);
    } catch (sapiErr) {
      throw new Error(`Both TTS engines failed.\nEdge TTS: ${edgeErr.message}\nSAPI: ${sapiErr.message}`);
    }
  }

  const stats = fs.statSync(OUTPUT_AUDIO);
  console.log(`  Audio file: ${(stats.size / 1024).toFixed(1)} KB`);
}

generateVoice().catch((err) => {
  console.error('generate-voice error:', err.message);
  process.exit(1);
});
