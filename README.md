# ReelForge — AI Video Maker

A fully local AI-powered video creation pipeline. Give it a script, it generates a voiceover, breaks it into scenes using a local or cloud LLM, and renders both a **YouTube video (1920x1080)** and **YouTube Shorts (1080x1920)** as `.mp4` files — all from your browser.

No CapCut. No cloud rendering fees. Just your machine and your browser.

---

## How It Works

```
Script (text)
     |
     v
[1] Generate Voiceover   -->  Microsoft Edge TTS (free, neural voices)
     |
     v
[2] Parse with AI        -->  Ollama (local) OR Anthropic Claude (cloud)
     |
     v
[3] Build Remotion       -->  React components generated per scene
     |
     |--> [4] Render YouTube Video  -->  out/final-video.mp4  (1920x1080)
     |
     '--> [5] Render YouTube Shorts -->  out/final-shorts.mp4 (1080x1920)
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Web UI | HTML / CSS / Vanilla JS |
| Backend | Node.js + Express |
| Scene Generation | Ollama (local) or Anthropic Claude (cloud) |
| Voiceover | Microsoft Edge TTS via msedge-tts |
| Video Framework | Remotion (React-based) |
| Audio Duration | fluent-ffmpeg |
| File Uploads | Multer |

---

## Prerequisites

| Requirement | How to get it |
|---|---|
| Node.js 18+ | https://nodejs.org |
| FFmpeg | `winget install ffmpeg` (Windows) / `brew install ffmpeg` (Mac) |
| Ollama (if using local AI) | https://ollama.com/download |
| Anthropic API key (if using cloud AI) | https://console.anthropic.com |

Verify installs:

```bash
node --version
ffmpeg -version
ollama --version
```

---

## Installation

```bash
git clone https://github.com/your-username/reelforge.git
cd reelforge
npm install
```

---

## Setup

Copy the example env file:

```bash
cp .env.example .env
```

Edit `.env`:

```
AI_PROVIDER=ollama

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral

ANTHROPIC_API_KEY=your_anthropic_api_key_here
RELAY_URL=your_cloudflare_worker_url_here

TTS_VOICE=en-US-AriaNeural
TTS_RATE=+0%
```

Set `AI_PROVIDER` to either `ollama` or `anthropic`.

---

## Running

**If using Ollama — open Terminal 1:**

```bash
ollama serve
```

**Terminal 2 (always):**

```bash
node server.js
```

Open your browser at `http://localhost:3000`

---

## AI Provider Options

You can switch between providers anytime from the **AI Model** page in the dashboard.

### Ollama (Local)

- Runs fully on your machine
- No API key needed
- Works offline
- Best models: `mistral`, `llama3.1`, `gemma2`

```bash
ollama pull mistral
```

### Anthropic Claude (Cloud)

- Uses Claude via a Cloudflare Worker relay
- Requires an Anthropic API key
- Higher accuracy for scene parsing and JSON output
- Model used: `claude-opus-4-7`

---

## Dashboard Pages

| Page | What you do |
|---|---|
| Dashboard | Readiness checklist — see what is ready at a glance |
| Script Editor | Write or upload your video script |
| Voice Settings | Choose from 11 Microsoft neural voices and speaking speed |
| AI Model | Switch between Ollama and Anthropic, configure credentials |
| Run Pipeline | One click runs all 4 stages with live logs |
| Storyboard | Preview every scene with color, timing, and transitions |

---

## Run Individual Stages

```bash
node generate-voice.js   # generate voiceover from script
node parse-script.js     # parse script into scenes using AI
node generate-video.js   # build Remotion React project
node render.js           # render both MP4 files
node index.js            # run full pipeline (all 4 stages)
```

---

## Output

| File | Format | Platform |
|---|---|---|
| `out/final-video.mp4` | 1920x1080 horizontal | YouTube, Desktop |
| `out/final-shorts.mp4` | 1080x1920 vertical | YouTube Shorts, Instagram Reels, TikTok |

---

## Recommended Ollama Models

| Model | Quality | Speed | Size |
|---|---|---|---|
| mistral | Best JSON accuracy | Fast | 4.1 GB |
| llama3.1 | Very good | Medium | 4.7 GB |
| gemma2 | Very structured | Medium | 5.4 GB |
| phi3 | Good for low RAM | Very fast | 2 GB |

---

## Available TTS Voices

| Voice ID | Description |
|---|---|
| en-US-AriaNeural | US Female, Natural (default) |
| en-US-GuyNeural | US Male, Natural |
| en-US-JennyNeural | US Female, Friendly |
| en-US-DavisNeural | US Male, Casual |
| en-US-TonyNeural | US Male, Enthusiastic |
| en-GB-SoniaNeural | UK Female |
| en-GB-RyanNeural | UK Male |
| en-AU-NatashaNeural | Australian Female |

---

## Project Structure

```
reelforge/
├── input/
│   └── script.txt          <- your script goes here
├── public/
│   └── index.html          <- web dashboard
├── .env                    <- your config (never committed)
├── .env.example            <- template to copy from
├── server.js               <- Express backend + SSE pipeline runner
├── generate-voice.js       <- TTS voiceover generator
├── parse-script.js         <- AI scene parser (Ollama or Anthropic)
├── generate-video.js       <- Remotion project builder (both layouts)
├── render.js               <- MP4 renderer (YouTube + Shorts)
├── index.js                <- CLI pipeline runner
└── package.json
```

Generated at runtime, not committed to git:
`src/`, `output/`, `out/`, `remotion.config.js`, `public/voiceover.mp3`

---

## Troubleshooting

**Ollama not found**

```bash
ollama serve
```

Make sure Ollama is installed and running before starting the app.

**FFmpeg not found**

```bash
winget install ffmpeg   # Windows
brew install ffmpeg     # macOS
sudo apt install ffmpeg # Linux
```

Reopen your terminal after installing.

**Invalid JSON from AI**

Re-run the Parse Script stage. Use `mistral` for Ollama or switch to Anthropic for the most reliable output.

**Edge TTS fails**

Falls back to Windows built-in TTS automatically. Edge TTS requires an internet connection.

**Anthropic relay errors**

Make sure your Cloudflare Worker URL is correct and the worker is deployed and active.

---

## License

MIT
