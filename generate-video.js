const fs = require('fs');
const path = require('path');

const STORYBOARD = path.join(__dirname, 'output', 'storyboard.json');
const SRC_DIR = path.join(__dirname, 'src');
const FPS = 30;

function secondsToFrames(s) { return Math.round(s * FPS); }

// ── Horizontal scene component (1920x1080) ────────────────────────────────────
function generateHScene(scene) {
  const fade = scene.transition === 'fade' || scene.transition === 'dissolve';
  return `
function HScene${scene.sceneNumber}({ durationInFrames }) {
  const frame = useCurrentFrame();
  const opacity = ${fade}
    ? interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const scale = interpolate(frame, [0, 20], [0.94, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ width:'100%', height:'100%', backgroundColor:'${scene.backgroundColor}', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', opacity, fontFamily:"'Helvetica Neue',Arial,sans-serif" }}>
      <div style={{ color:'#fff', fontSize:72, fontWeight:900, textAlign:'center', padding:'0 80px', lineHeight:1.1, textTransform:'uppercase', letterSpacing:'-1px', transform:\`scale(\${scale})\`, textShadow:'0 4px 24px rgba(0,0,0,.5)' }}>
        ${scene.onScreenText}
      </div>
      <div style={{ color:'rgba(255,255,255,.6)', fontSize:26, fontWeight:400, marginTop:28, textAlign:'center', padding:'0 120px', letterSpacing:'.4px' }}>
        ${scene.title}
      </div>
      <div style={{ position:'absolute', bottom:56, left:0, right:0, textAlign:'center', color:'rgba(255,255,255,.32)', fontSize:17, fontStyle:'italic', padding:'0 160px' }}>
        ${scene.voiceover.replace(/'/g, "\\'").substring(0, 120)}${scene.voiceover.length > 120 ? '...' : ''}
      </div>
    </div>
  );
}`;
}

// ── Vertical scene component (1080x1920) ──────────────────────────────────────
function generateVScene(scene) {
  const fade = scene.transition === 'fade' || scene.transition === 'dissolve';
  return `
function VScene${scene.sceneNumber}({ durationInFrames }) {
  const frame = useCurrentFrame();
  const opacity = ${fade}
    ? interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const scale = interpolate(frame, [0, 20], [0.93, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [0, 20], [18, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ width:'100%', height:'100%', backgroundColor:'${scene.backgroundColor}', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'120px 70px', opacity, fontFamily:"'Helvetica Neue',Arial,sans-serif", position:'relative' }}>
      <div style={{ position:'absolute', top:90, fontSize:22, color:'rgba(255,255,255,.35)', textTransform:'uppercase', letterSpacing:'4px', fontWeight:600 }}>
        Scene ${scene.sceneNumber}
      </div>
      <div style={{ color:'#fff', fontSize:88, fontWeight:900, textAlign:'center', lineHeight:1.08, textTransform:'uppercase', letterSpacing:'-1.5px', transform:\`scale(\${scale}) translateY(\${textY}px)\`, textShadow:'0 6px 32px rgba(0,0,0,.6)', marginBottom:36 }}>
        ${scene.onScreenText}
      </div>
      <div style={{ color:'rgba(255,255,255,.55)', fontSize:34, fontWeight:500, textAlign:'center', letterSpacing:'.3px', lineHeight:1.3 }}>
        ${scene.title}
      </div>
      <div style={{ position:'absolute', bottom:110, left:70, right:70, textAlign:'center', color:'rgba(255,255,255,.38)', fontSize:26, lineHeight:1.65, fontStyle:'italic' }}>
        ${scene.voiceover.replace(/'/g, "\\'").substring(0, 100)}${scene.voiceover.length > 100 ? '...' : ''}
      </div>
    </div>
  );
}`;
}

// ── Video.jsx (horizontal 1920x1080) ──────────────────────────────────────────
function generateVideoJsx(storyboard) {
  const hScenes = storyboard.scenes.map(generateHScene).join('\n');
  let offset = 0;
  const sequences = storyboard.scenes.map((s) => {
    const frames = secondsToFrames(s.duration);
    const from = offset; offset += frames;
    return `      <Sequence from={${from}} durationInFrames={${frames}}><HScene${s.sceneNumber} durationInFrames={${frames}} /></Sequence>`;
  }).join('\n');

  return `const { Sequence, Audio, useCurrentFrame, interpolate, staticFile } = require('remotion');
${hScenes}

function VideoOutput() {
  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <Audio src={staticFile('voiceover.mp3')} />
${sequences}
    </div>
  );
}
module.exports = { VideoOutput };
`;
}

// ── Shorts.jsx (vertical 1080x1920) ──────────────────────────────────────────
function generateShortsJsx(storyboard) {
  const vScenes = storyboard.scenes.map(generateVScene).join('\n');
  let offset = 0;
  const sequences = storyboard.scenes.map((s) => {
    const frames = secondsToFrames(s.duration);
    const from = offset; offset += frames;
    return `      <Sequence from={${from}} durationInFrames={${frames}}><VScene${s.sceneNumber} durationInFrames={${frames}} /></Sequence>`;
  }).join('\n');

  return `const { Sequence, Audio, useCurrentFrame, interpolate, staticFile } = require('remotion');
${vScenes}

function ShortsOutput() {
  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <Audio src={staticFile('voiceover.mp3')} />
${sequences}
    </div>
  );
}
module.exports = { ShortsOutput };
`;
}

// ── Root.jsx ──────────────────────────────────────────────────────────────────
function generateRootJsx(totalFrames) {
  return `const { Composition } = require('remotion');
const { VideoOutput } = require('./Video.jsx');
const { ShortsOutput } = require('./Shorts.jsx');

function Root() {
  return (
    <>
      <Composition id="VideoOutput"  component={VideoOutput}  durationInFrames={${totalFrames}} fps={30} width={1920} height={1080} />
      <Composition id="ShortsOutput" component={ShortsOutput} durationInFrames={${totalFrames}} fps={30} width={1080} height={1920} />
    </>
  );
}
module.exports = { RemotionRoot: Root };
`;
}

function generateIndexJs() {
  return `const { registerRoot } = require('remotion');
const { RemotionRoot } = require('./Root.jsx');
registerRoot(RemotionRoot);
`;
}

function generateRemotionConfig() {
  return `const { Config } = require('@remotion/cli/config');
Config.setEntryPoint('./src/index.js');
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function generateVideo() {
  if (!fs.existsSync(STORYBOARD)) {
    throw new Error(`Storyboard not found: ${STORYBOARD}\nRun parse-script.js first.`);
  }

  const storyboard = JSON.parse(fs.readFileSync(STORYBOARD, 'utf-8'));
  console.log(`  Loaded ${storyboard.scenes.length} scenes (${storyboard.totalDuration}s)`);

  if (!fs.existsSync(SRC_DIR)) fs.mkdirSync(SRC_DIR, { recursive: true });

  const totalFrames = secondsToFrames(storyboard.totalDuration);

  fs.writeFileSync(path.join(SRC_DIR, 'Video.jsx'), generateVideoJsx(storyboard));
  console.log('  Generated src/Video.jsx  (1920x1080 horizontal)');

  fs.writeFileSync(path.join(SRC_DIR, 'Shorts.jsx'), generateShortsJsx(storyboard));
  console.log('  Generated src/Shorts.jsx (1080x1920 vertical)');

  fs.writeFileSync(path.join(SRC_DIR, 'Root.jsx'), generateRootJsx(totalFrames));
  console.log('  Generated src/Root.jsx   (both compositions registered)');

  fs.writeFileSync(path.join(SRC_DIR, 'index.js'), generateIndexJs());
  fs.writeFileSync(path.join(__dirname, 'remotion.config.js'), generateRemotionConfig());

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const audioSrc = path.join(__dirname, 'input', 'voiceover.mp3');
  if (fs.existsSync(audioSrc)) {
    fs.copyFileSync(audioSrc, path.join(publicDir, 'voiceover.mp3'));
    console.log('  Copied voiceover.mp3 → public/');
  }

  console.log(`  Project ready — ${totalFrames} frames at ${FPS}fps`);
}

generateVideo();
