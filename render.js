const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'out');
const OUT_VIDEO  = path.join(OUT_DIR, 'final-video.mp4');
const OUT_SHORTS = path.join(OUT_DIR, 'final-shorts.mp4');

function fmt(bytes) {
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function renderComposition(id, outFile, label) {
  console.log(`\n  Rendering ${label}...`);
  const cmd = `npx remotion render src/index.js ${id} "${outFile}" --codec=h264`;
  try {
    execSync(cmd, {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  } catch (err) {
    throw new Error(`Render failed for ${label}: ${err.message}`);
  }
  if (!fs.existsSync(outFile)) throw new Error(`Output not found: ${outFile}`);
  const size = fs.statSync(outFile).size;
  console.log(`  Saved: ${outFile} (${fmt(size)})`);
}

function render() {
  if (!fs.existsSync(path.join(__dirname, 'src', 'index.js'))) {
    throw new Error('src/index.js not found — run generate-video.js first.');
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  renderComposition('VideoOutput',  OUT_VIDEO,  'YouTube Video  (1920x1080)');
  renderComposition('ShortsOutput', OUT_SHORTS, 'YouTube Shorts (1080x1920)');

  console.log('\n  Both videos rendered successfully.');
  console.log(`  YouTube Video  → out/final-video.mp4`);
  console.log(`  YouTube Shorts → out/final-shorts.mp4`);
}

render();
