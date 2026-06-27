require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');

const app = express();
const PORT = 3000;

const INPUT_DIR = path.join(__dirname, 'input');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUT_DIR = path.join(__dirname, 'out');
const ENV_FILE = path.join(__dirname, '.env');

[INPUT_DIR, OUTPUT_DIR, OUT_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ───────────────────────────────────────────────────────────────────

function readEnv() {
  const defaults = {
    AI_PROVIDER: 'ollama',
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'mistral',
    ANTHROPIC_API_KEY: '',
    RELAY_URL: '',
    TTS_VOICE: 'en-US-AriaNeural',
    TTS_RATE: '+0%',
  };
  if (!fs.existsSync(ENV_FILE)) return defaults;
  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
  const env = { ...defaults };
  lines.forEach((line) => {
    const [k, ...v] = line.split('=');
    if (k && k.trim() && v.length) env[k.trim()] = v.join('=').trim();
  });
  return env;
}

function writeEnv(obj) {
  const content = Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(ENV_FILE, content);
  Object.entries(obj).forEach(([k, v]) => { process.env[k] = v; });
}

// ── File uploads ──────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, INPUT_DIR),
  filename: (req, file, cb) => {
    const name = file.fieldname === 'audio' ? 'voiceover.mp3' : 'script.txt';
    cb(null, name);
  },
});
const upload = multer({ storage });

app.post('/api/upload/script', upload.single('script'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const content = fs.readFileSync(req.file.path, 'utf-8');
  res.json({ success: true, preview: content.substring(0, 400), size: req.file.size });
});

app.post('/api/upload/audio', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.originalname, size: req.file.size });
});

// ── Config ────────────────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  const env = readEnv();
  const apiKey = env.ANTHROPIC_API_KEY || '';
  const hasKey = apiKey && apiKey !== 'your_anthropic_api_key_here';
  const relayUrl = env.RELAY_URL || '';
  const hasRelay = relayUrl && relayUrl !== 'your_cloudflare_worker_url_here';
  res.json({
    aiProvider:   env.AI_PROVIDER   || 'ollama',
    ollamaUrl:    env.OLLAMA_URL    || 'http://localhost:11434',
    ollamaModel:  env.OLLAMA_MODEL  || 'mistral',
    anthropicKey: hasKey  ? '••••••' + apiKey.slice(-4) : '',
    relayUrl:     hasRelay ? relayUrl : '',
    hasAnthropicKey: hasKey,
    hasRelayUrl:     hasRelay,
    ttsVoice: env.TTS_VOICE || 'en-US-AriaNeural',
    ttsRate:  env.TTS_RATE  || '+0%',
  });
});

app.post('/api/config', (req, res) => {
  const { ollamaUrl, ollamaModel, ttsVoice, ttsRate, aiProvider, anthropicKey, relayUrl } = req.body;
  const current = readEnv();
  writeEnv({
    AI_PROVIDER:       aiProvider    || current.AI_PROVIDER,
    OLLAMA_URL:        ollamaUrl     || current.OLLAMA_URL,
    OLLAMA_MODEL:      ollamaModel   || current.OLLAMA_MODEL,
    ANTHROPIC_API_KEY: anthropicKey  || current.ANTHROPIC_API_KEY,
    RELAY_URL:         relayUrl      || current.RELAY_URL,
    TTS_VOICE:         ttsVoice      || current.TTS_VOICE,
    TTS_RATE:          ttsRate       || current.TTS_RATE,
  });
  res.json({ success: true });
});

// ── Anthropic status ──────────────────────────────────────────────────────────

app.get('/api/anthropic/status', (req, res) => {
  const env = readEnv();
  const hasKey   = env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
  const hasRelay = env.RELAY_URL && env.RELAY_URL !== 'your_cloudflare_worker_url_here';
  res.json({ configured: !!(hasKey && hasRelay), hasKey: !!hasKey, hasRelay: !!hasRelay });
});

// ── Ollama integration ────────────────────────────────────────────────────────

app.get('/api/ollama/status', async (req, res) => {
  const env = readEnv();
  const url = env.OLLAMA_URL || 'http://localhost:11434';
  try {
    await axios.get(`${url}/api/tags`, { timeout: 4000 });
    res.json({ running: true, url });
  } catch {
    res.json({ running: false, url });
  }
});

app.get('/api/ollama/models', async (req, res) => {
  const env = readEnv();
  const url = env.OLLAMA_URL || 'http://localhost:11434';
  try {
    const r = await axios.get(`${url}/api/tags`, { timeout: 5000 });
    const models = (r.data.models || []).map((m) => m.name);
    res.json({ models });
  } catch {
    res.json({ models: [], error: 'Ollama not reachable' });
  }
});

// ── TTS voices list ───────────────────────────────────────────────────────────

app.get('/api/voices', (req, res) => {
  res.json({
    voices: [
      { id: 'en-US-AriaNeural',    label: 'Aria (US Female, Natural)' },
      { id: 'en-US-GuyNeural',     label: 'Guy (US Male, Natural)' },
      { id: 'en-US-JennyNeural',   label: 'Jenny (US Female, Friendly)' },
      { id: 'en-US-DavisNeural',   label: 'Davis (US Male, Casual)' },
      { id: 'en-US-TonyNeural',    label: 'Tony (US Male, Enthusiastic)' },
      { id: 'en-US-NancyNeural',   label: 'Nancy (US Female, Pleasant)' },
      { id: 'en-GB-SoniaNeural',   label: 'Sonia (UK Female)' },
      { id: 'en-GB-RyanNeural',    label: 'Ryan (UK Male)' },
      { id: 'en-AU-NatashaNeural', label: 'Natasha (AU Female)' },
      { id: 'en-AU-WilliamNeural', label: 'William (AU Male)' },
      { id: 'en-IN-NeerjaNeural',  label: 'Neerja (IN Female)' },
    ],
  });
});

// ── File status ───────────────────────────────────────────────────────────────

app.get('/api/files', (req, res) => {
  const stat = (p) => {
    try { const s = fs.statSync(p); return { exists: true, size: s.size, modified: s.mtime }; }
    catch { return { exists: false }; }
  };
  res.json({
    script:     stat(path.join(INPUT_DIR, 'script.txt')),
    audio:      stat(path.join(INPUT_DIR, 'voiceover.mp3')),
    storyboard: stat(path.join(OUTPUT_DIR, 'storyboard.json')),
    video:      stat(path.join(OUT_DIR, 'final-video.mp4')),
    shorts:     stat(path.join(OUT_DIR, 'final-shorts.mp4')),
  });
});

// ── Storyboard ────────────────────────────────────────────────────────────────

app.get('/api/storyboard', (req, res) => {
  const p = path.join(OUTPUT_DIR, 'storyboard.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No storyboard yet' });
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

// ── Script content ────────────────────────────────────────────────────────────

app.get('/api/script', (req, res) => {
  const p = path.join(INPUT_DIR, 'script.txt');
  if (!fs.existsSync(p)) return res.json({ content: '' });
  res.json({ content: fs.readFileSync(p, 'utf-8') });
});

app.post('/api/script', express.text(), (req, res) => {
  fs.writeFileSync(path.join(INPUT_DIR, 'script.txt'), req.body);
  res.json({ success: true });
});

// ── Pipeline runner (SSE) ─────────────────────────────────────────────────────

let pipelineRunning = false;

const STAGE_SCRIPTS = {
  voice:    { file: 'generate-voice.js',  label: '[1/4] Generating voiceover...' },
  parse:    { file: 'parse-script.js',    label: '[2/4] Parsing script with Ollama...' },
  generate: { file: 'generate-video.js',  label: '[3/4] Building Remotion project...' },
  render:   { file: 'render.js',          label: '[4/4] Rendering final video...' },
};

const PIPELINE_STAGES = {
  all:      ['voice', 'parse', 'generate', 'render'],
  voice:    ['voice'],
  parse:    ['parse'],
  generate: ['generate'],
  render:   ['render'],
  novoice:  ['parse', 'generate', 'render'],
};

app.get('/api/run', (req, res) => {
  if (pipelineRunning) {
    return res.status(409).json({ error: 'Pipeline already running' });
  }

  const stageName = req.query.stage || 'all';
  const stages = PIPELINE_STAGES[stageName] || PIPELINE_STAGES.all;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  pipelineRunning = true;

  const runNext = (index) => {
    if (index >= stages.length) {
      send('done', { message: 'Pipeline complete! Video saved to out/final-video.mp4' });
      pipelineRunning = false;
      res.end();
      return;
    }

    const key = stages[index];
    const { file, label } = STAGE_SCRIPTS[key];
    send('stage', { label, key });

    const proc = spawn('node', [path.join(__dirname, file)], {
      cwd: __dirname,
      env: { ...process.env, ...Object.fromEntries(
        Object.entries(readEnv()).map(([k, v]) => [k, v])
      )},
    });

    proc.stdout.on('data', (d) => send('log', { text: d.toString() }));
    proc.stderr.on('data', (d) => send('log', { text: d.toString(), isError: true }));

    proc.on('close', (code) => {
      if (code !== 0) {
        send('error', { message: `Stage failed: ${file} (exit ${code})` });
        pipelineRunning = false;
        res.end();
        return;
      }
      runNext(index + 1);
    });
  };

  runNext(0);
  req.on('close', () => { pipelineRunning = false; });
});

app.get('/api/status', (req, res) => res.json({ running: pipelineRunning }));

// ── Download ──────────────────────────────────────────────────────────────────

app.get('/api/download', (req, res) => {
  const p = path.join(OUT_DIR, 'final-video.mp4');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No video yet' });
  res.download(p, 'final-video.mp4');
});

app.get('/api/download/shorts', (req, res) => {
  const p = path.join(OUT_DIR, 'final-shorts.mp4');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No shorts video yet' });
  res.download(p, 'final-shorts.mp4');
});

app.listen(PORT, () => {
  console.log(`\n  AI Video Maker  →  http://localhost:${PORT}\n`);
});
