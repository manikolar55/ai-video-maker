const { execSync } = require('child_process');
const path = require('path');

function run(script, label) {
  console.log(`\n${label}`);
  try {
    execSync(`node ${script}`, { cwd: __dirname, stdio: 'inherit' });
  } catch {
    console.error(`\nPipeline failed at: ${label}`);
    process.exit(1);
  }
}

console.log('=== AI Video Maker ===');

run(path.join(__dirname, 'generate-voice.js'), '[1/4] Generating voiceover with TTS...');
run(path.join(__dirname, 'parse-script.js'),   '[2/4] Parsing script with Ollama...');
run(path.join(__dirname, 'generate-video.js'), '[3/4] Building Remotion video project...');
run(path.join(__dirname, 'render.js'),          '[4/4] Rendering final video...');

console.log('\nDone. Video saved to out/final-video.mp4');
