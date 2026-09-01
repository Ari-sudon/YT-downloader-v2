import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 80, 120);
camera.lookAt(0, 20, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('scene'),
  antialias: true,
  alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, 0.4, 0.85
);
composer.addPass(bloomPass);

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
composer.addPass(fxaaPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.minDistance = 50;
controls.maxDistance = 300;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.target.set(0, 20, 0);

const cityGroup = new THREE.Group();
scene.add(cityGroup);

const buildingGeometries = [];
const buildingMaterials = [];
const buildings = [];
const neonLights = [];
const particles = [];
let rainParticles = null;
let fogMaterial = null;

const buildingColors = [
  new THREE.Color(0x0a0a1a),
  new THREE.Color(0x1a0a2a),
  new THREE.Color(0x0a1a2a),
  new THREE.Color(0x1a1a0a),
  new THREE.Color(0x2a0a1a)
];

const neonColors = [
  0xff006e, 0x00f3ff, 0x8b5cf6, 0x39ff14,
  0xffbe0b, 0xfb5607, 0x8338ec, 0x06ffa5
];

function createBuildingGeometry() {
  const types = [
    () => new THREE.BoxGeometry(1, 1, 1),
    () => new THREE.CylinderGeometry(1, 1, 1, 8),
    () => new THREE.CylinderGeometry(0.8, 1.2, 1, 6),
    () => new THREE.BoxGeometry(1, 1, 1, 2, 2, 2)
  ];
  return types[Math.floor(Math.random() * types.length)]();
}

for (let i = 0; i < 20; i++) {
  const geo = createBuildingGeometry();
  geo.scale(1, 1, 1);
  buildingGeometries.push(geo);
}

const windowGeometry = new THREE.PlaneGeometry(0.8, 1.2);
const windowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffee,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide
});

const neonGeometry = new THREE.PlaneGeometry(1, 0.15);

function createBuilding(x, z, isHero = false) {
  const baseScale = isHero ? 
    { x: 8 + Math.random() * 12, y: 60 + Math.random() * 80, z: 8 + Math.random() * 12 } :
    { x: 4 + Math.random() * 8, y: 20 + Math.random() * 60, z: 4 + Math.random() * 8 };
  
  const geo = buildingGeometries[Math.floor(Math.random() * buildingGeometries.length)].clone();
  geo.scale(baseScale.x, baseScale.y, baseScale.z);
  geo.translate(0, baseScale.y / 2, 0);
  
  const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3,
    envMapIntensity: 0.5
  });
  
  const building = new THREE.Mesh(geo, mat);
  building.castShadow = true;
  building.receiveShadow = true;
  building.position.set(x, 0, z);
  building.userData = { baseScale, windows: [], neons: [] };
  
  const windowCount = Math.floor((baseScale.x + baseScale.z) * 2);
  for (let i = 0; i < windowCount; i++) {
    const side = Math.floor(Math.random() * 4);
    const h = Math.random() * baseScale.y * 0.9;
    const offset = (Math.random() - 0.5) * (side % 2 === 0 ? baseScale.x : baseScale.z) * 0.8;
    
    const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial.clone());
    windowMesh.material.opacity = 0.3 + Math.random() * 0.6;
    windowMesh.material.color.setHSL(Math.random() * 0.1 + 0.05, 0.3, 0.7 + Math.random() * 0.3);
    
    const angle = side * Math.PI / 2;
    const dist = (side % 2 === 0 ? baseScale.x : baseScale.z) / 2 + 0.05;
    
    windowMesh.position.set(
      Math.sin(angle) * dist + Math.cos(angle) * offset,
      h,
      Math.cos(angle) * dist - Math.sin(angle) * offset
    );
    windowMesh.rotation.y = angle + Math.PI / 2;
    windowMesh.userData = { 
      baseOpacity: windowMesh.material.opacity,
      flickerSpeed: 0.5 + Math.random() * 2,
      flickerOffset: Math.random() * Math.PI * 2
    };
    building.add(windowMesh);
    building.userData.windows.push(windowMesh);
  }
  
  const neonCount = isHero ? 8 + Math.floor(Math.random() * 8) : 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < neonCount; i++) {
    const side = Math.floor(Math.random() * 4);
    const h = baseScale.y * (0.3 + Math.random() * 0.6);
    const offset = (Math.random() - 0.5) * (side % 2 === 0 ? baseScale.x : baseScale.z) * 0.7;
    
    const neonMat = new THREE.MeshBasicMaterial({
      color: neonColors[Math.floor(Math.random() * neonColors.length)],
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const neonMesh = new THREE.Mesh(neonGeometry, neonMat);
    neonMesh.scale.set(
      (side % 2 === 0 ? baseScale.x : baseScale.z) * 0.6,
      1,
      1
    );
    
    const angle = side * Math.PI / 2;
    const dist = (side % 2 === 0 ? baseScale.x : baseScale.z) / 2 + 0.2;
    
    neonMesh.position.set(
      Math.sin(angle) * dist + Math.cos(angle) * offset,
      h,
      Math.cos(angle) * dist - Math.sin(angle) * offset
    );
    neonMesh.rotation.y = angle + Math.PI / 2;
    neonMesh.userData = {
      baseColor: neonMat.color.clone(),
      pulseSpeed: 1 + Math.random() * 3,
      pulseOffset: Math.random() * Math.PI * 2
    };
    building.add(neonMesh);
    building.userData.neons.push(neonMesh);
    neonLights.push(neonMesh);
  }
  
  if (isHero) {
    const topGeo = new THREE.ConeGeometry(baseScale.x * 0.4, 10, 4);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.5,
      metalness: 0.5
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = baseScale.y + 5;
    top.castShadow = true;
    building.add(top);
    
    const spireGeo = new THREE.CylinderGeometry(0.3, 0.1, 15, 4);
    const spireMat = new THREE.MeshBasicMaterial({ color: 0xff006e, transparent: true, opacity: 0.9 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = baseScale.y + 17.5;
    building.add(spire);
  }
  
  cityGroup.add(building);
  buildings.push(building);
  return building;
}

const gridSize = 12;
const spacing = 28;
for (let gx = -gridSize; gx <= gridSize; gx++) {
  for (let gz = -gridSize; gz <= gridSize; gz++) {
    if (gx === 0 && gz === 0) continue;
    const distance = Math.sqrt(gx * gx + gz * gz);
    if (distance > gridSize * 0.9) continue;
    
    const x = gx * spacing + (Math.random() - 0.5) * 8;
    const z = gz * spacing + (Math.random() - 0.5) * 8;
    const isHero = distance < 2 && Math.random() < 0.3;
    createBuilding(x, z, isHero);
  }
}

const groundGeo = new THREE.PlaneGeometry(800, 800);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x050515,
  roughness: 0.9,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = -0.1;
scene.add(ground);

const streetGeo = new THREE.PlaneGeometry(800, 12);
const streetMat = new THREE.MeshBasicMaterial({
  color: 0x0a0a1a,
  transparent: true,
  opacity: 0.8
});
for (let i = -gridSize; i <= gridSize; i++) {
  const hStreet = new THREE.Mesh(streetGeo, streetMat.clone());
  hStreet.rotation.x = -Math.PI / 2;
  hStreet.position.set(0, 0.01, i * spacing);
  scene.add(hStreet);
  
  const vStreet = new THREE.Mesh(streetGeo, streetMat.clone());
  vStreet.rotation.x = -Math.PI / 2;
  vStreet.rotation.z = Math.PI / 2;
  vStreet.position.set(i * spacing, 0.01, 0);
  scene.add(vStreet);
}

const ambientLight = new THREE.AmbientLight(0x221133, 0.5);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x88aaff, 0.8);
moonLight.position.set(100, 200, 100);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 10;
moonLight.shadow.camera.far = 400;
moonLight.shadow.camera.left = -200;
moonLight.shadow.camera.right = 200;
moonLight.shadow.camera.top = 200;
moonLight.shadow.camera.bottom = -200;
moonLight.shadow.bias = -0.0005;
scene.add(moonLight);

const pinkLight = new THREE.PointLight(0xff006e, 2, 150);
pinkLight.position.set(-50, 40, -50);
pinkLight.castShadow = true;
scene.add(pinkLight);

const blueLight = new THREE.PointLight(0x00f3ff, 2, 150);
blueLight.position.set(50, 40, 50);
blueLight.castShadow = true;
scene.add(blueLight);

const purpleLight = new THREE.PointLight(0x8b5cf6, 1.5, 100);
purpleLight.position.set(0, 60, 0);
scene.add(purpleLight);

const particleCount = 5000;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const colors = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  const radius = 50 + Math.random() * 300;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  
  positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = Math.random() * 150;
  positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  
  sizes[i] = 0.5 + Math.random() * 2;
  
  const colorChoice = Math.random();
  if (colorChoice < 0.33) {
    colors[i * 3] = 1; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0.4;
  } else if (colorChoice < 0.66) {
    colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
  } else {
    colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 1;
  }
  
  velocities[i * 3] = (Math.random() - 0.5) * 0.02;
  velocities[i * 3 + 1] = -0.01 - Math.random() * 0.05;
  velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particleMat = new THREE.PointsMaterial({
  size: 2,
  vertexColors: true,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);

function createRain() {
  const rainCount = 3000;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  const rainVelocities = new Float32Array(rainCount * 3);
  
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 400;
    rainPositions[i * 3 + 1] = Math.random() * 200 + 50;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    
    rainVelocities[i * 3] = 0;
    rainVelocities[i * 3 + 1] = -0.5 - Math.random() * 0.3;
    rainVelocities[i * 3 + 2] = 0;
  }
  
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.setAttribute('velocity', new THREE.BufferAttribute(rainVelocities, 3));
  
  const rainMat = new THREE.PointsMaterial({
    size: 0.3,
    color: 0x88ccff,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  rainParticles = new THREE.Points(rainGeo, rainMat);
  rainParticles.visible = false;
  scene.add(rainParticles);
  return { geometry: rainGeo, velocities: rainVelocities };
}

const rain = createRain();

const fogGeo = new THREE.PlaneGeometry(800, 800, 50, 50);
const fogPositions = fogGeo.attributes.position.array;
for (let i = 0; i < fogPositions.length; i += 3) {
  fogPositions[i + 1] = Math.random() * 5;
}
fogGeo.computeVertexNormals();

fogMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0x001122) },
    uDensity: { value: 0.3 },
    uHeight: { value: 30 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vHeight;
    void main() {
      vUv = uv;
      vHeight = position.y;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uFogColor;
    uniform float uDensity;
    uniform float uHeight;
    varying vec2 vUv;
    varying float vHeight;
    
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    void main() {
      float heightFactor = smoothstep(0.0, uHeight, vHeight);
      float n = fbm(vUv * 10.0 + uTime * 0.05);
      float alpha = (1.0 - heightFactor) * uDensity * (0.5 + n * 0.5);
      gl_FragColor = vec4(uFogColor, alpha * 0.3);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.NormalBlending
});

const fogMesh = new THREE.Mesh(fogGeo, fogMaterial);
fogMesh.rotation.x = -Math.PI / 2;
fogMesh.position.y = 2;
scene.add(fogMesh);

const starsGeo = new THREE.BufferGeometry();
const starCount = 2000;
const starPositions = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
for (let i = 0; i < starCount; i++) {
  const radius = 400 + Math.random() * 200;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.5 + 100;
  starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  starSizes[i] = 0.5 + Math.random() * 1.5;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
const starsMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 2,
  transparent: true,
  opacity: 0.8,
  sizeAttenuation: true,
  depthWrite: false
});
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeSlider = document.getElementById('volumeSlider');
const progressFill = document.getElementById('progressFill');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const timeDisplay = document.getElementById('timeDisplay');
const visCanvas = document.getElementById('visCanvas');
const buildingCountEl = document.getElementById('buildingCount');
const particleCountEl = document.getElementById('particleCount');
const fpsEl = document.getElementById('fps');
const loading = document.getElementById('loading');
const rainToggle = document.getElementById('rainToggle');
const fogToggle = document.getElementById('fogToggle');
const neonToggle = document.getElementById('neonToggle');
const temperatureEl = document.getElementById('temperature');
const conditionEl = document.getElementById('condition');

const tracks = [
  { title: 'Midnight Drive', artist: 'Neon Nights', src: 'music/track.mp3' },
  { title: 'Rainy Shibuya', artist: 'LoFi Tokyo', src: 'music/track2.mp3' },
  { title: 'Neon Dreams', artist: 'Synthwave City', src: 'music/track3.mp3' }
];
let currentTrack = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
analyser.smoothingTimeConstant = 0.8;

let sourceNode = null;
let isAudioInitialized = false;

async function initAudio() {
  if (isAudioInitialized) return;
  try {
    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    isAudioInitialized = true;
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
}

function playTrack(index) {
  currentTrack = (index + tracks.length) % tracks.length;
  const track = tracks[currentTrack];
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  audio.src = track.src;
  audio.load();
  initAudio().then(() => audio.play().catch(() => {}));
}

playBtn.addEventListener('click', async () => {
  await initAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  
  if (audio.paused) {
    audio.play();
    playBtn.textContent = '⏸';
  } else {
    audio.pause();
    playBtn.textContent = '▶';
  }
});

prevBtn.addEventListener('click', () => playTrack(currentTrack - 1));
nextBtn.addEventListener('click', () => playTrack(currentTrack + 1));

volumeSlider.addEventListener('input', (e) => {
  audio.volume = e.target.value;
});

audio.addEventListener('timeupdate', () => {
  const progress = (audio.currentTime / audio.duration) * 100 || 0;
  progressFill.style.width = `${progress}%`;
});

audio.addEventListener('ended', () => playTrack(currentTrack + 1));

const visCtx = visCanvas.getContext('2d');
function resizeVisCanvas() {
  const rect = visCanvas.parentElement.getBoundingClientRect();
  visCanvas.width = rect.width * window.devicePixelRatio;
  visCanvas.height = rect.height * window.devicePixelRatio;
  visCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
resizeVisCanvas();
window.addEventListener('resize', resizeVisCanvas);

function drawVisualizer() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function draw() {
    if (!isAudioInitialized) {
      requestAnimationFrame(draw);
      return;
    }
    
    analyser.getByteFrequencyData(dataArray);
    
    const width = visCanvas.width / window.devicePixelRatio;
    const height = visCanvas.height / window.devicePixelRatio;
    
    visCtx.clearRect(0, 0, width, height);
    
    const barWidth = width / bufferLength * 2;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.8;
      const hue = 300 + (i / bufferLength) * 60;
      
      const gradient = visCtx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
      gradient.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
      
      visCtx.fillStyle = gradient;
      visCtx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      visCtx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      visCtx.fillRect(x, height - barHeight - 2, barWidth, 2);
      
      x += barWidth + 1;
    }
    
    requestAnimationFrame(draw);
  }
  draw();
}

drawVisualizer();

rainToggle.addEventListener('change', (e) => {
  rainParticles.visible = e.target.checked;
  conditionEl.textContent = e.target.checked ? 'RAINY NIGHT' : 'CLEAR NIGHT';
  if (e.target.checked) fogToggle.checked = true;
});

fogToggle.addEventListener('change', (e) => {
  fogMesh.visible = e.target.checked;
});

neonToggle.addEventListener('change', (e) => {
  neonLights.forEach(neon => neon.visible = e.target.checked);
  bloomPass.strength = e.target.checked ? 1.5 : 0.3;
});

let lastTime = performance.now();
let frameCount = 0;
let fps = 60;

function animate(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  
  frameCount++;
  if (frameCount % 30 === 0) {
    fps = Math.round(1000 / (time - (lastTime - delta * 1000)) * 30) || 60;
    fpsEl.textContent = fps;
    buildingCountEl.textContent = buildings.length;
    particleCountEl.textContent = particleCount;
  }
  
  const t = time * 0.001;
  
  controls.update();
  
  camera.position.x = Math.sin(t * 0.05) * 120;
  camera.position.z = Math.cos(t * 0.05) * 120;
  camera.position.y = 80 + Math.sin(t * 0.03) * 10;
  camera.lookAt(0, 20 + Math.sin(t * 0.02) * 5, 0);
  
  pinkLight.position.x = Math.sin(t * 0.3) * 60;
  pinkLight.position.z = Math.cos(t * 0.3) * 60;
  pinkLight.intensity = 1.5 + Math.sin(t * 2) * 0.5;
  
  blueLight.position.x = Math.sin(t * 0.25 + 2) * 60;
  blueLight.position.z = Math.cos(t * 0.25 + 2) * 60;
  blueLight.intensity = 1.5 + Math.cos(t * 1.7) * 0.5;
  
  purpleLight.intensity = 1 + Math.sin(t * 1.3) * 0.5;
  
  buildings.forEach((building, i) => {
    building.userData.windows.forEach((window, j) => {
      const flicker = Math.sin(t * window.userData.flickerSpeed + window.userData.flickerOffset + i * 0.5);
      window.material.opacity = window.userData.baseOpacity * (0.7 + flicker * 0.3);
    });
    
    building.userData.neons.forEach((neon, j) => {
      const pulse = Math.sin(t * neon.userData.pulseSpeed + neon.userData.pulseOffset);
      neon.material.opacity = 0.5 + pulse * 0.4;
      const intensity = 0.7 + pulse * 0.3;
      neon.material.color.lerpColors(neon.userData.baseColor, new THREE.Color(0xffffff), intensity * 0.3);
    });
  });
  
  const positions = particleSystem.geometry.attributes.position.array;
  const pVelocities = velocities;
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] += pVelocities[i * 3];
    positions[i * 3 + 1] += pVelocities[i * 3 + 1];
    positions[i * 3 + 2] += pVelocities[i * 3 + 2];
    
    if (positions[i * 3 + 1] < -10) {
      positions[i * 3 + 1] = 150 + Math.random() * 50;
      positions[i * 3] = (Math.random() - 0.5) * 400;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    
    const dist = Math.sqrt(positions[i * 3] ** 2 + positions[i * 3 + 2] ** 2);
    if (dist > 350) {
      const angle = Math.atan2(positions[i * 3 + 2], positions[i * 3]);
      positions[i * 3] = Math.cos(angle) * 340;
      positions[i * 3 + 2] = Math.sin(angle) * 340;
    }
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.rotation.y += 0.0001;
  
  if (rainParticles.visible) {
    const rainPositions = rain.geometry.attributes.position.array;
    const rainVelocities = rain.velocities;
    for (let i = 0; i < rainPositions.length / 3; i++) {
      rainPositions[i * 3] += rainVelocities[i * 3];
      rainPositions[i * 3 + 1] += rainVelocities[i * 3 + 1];
      rainPositions[i * 3 + 2] += rainVelocities[i * 3 + 2];
      
      if (rainPositions[i * 3 + 1] < 0) {
        rainPositions[i * 3] = camera.position.x + (Math.random() - 0.5) * 400;
        rainPositions[i * 3 + 1] = 200 + Math.random() * 50;
        rainPositions[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 400;
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  
  if (fogMesh.visible) {
    fogMaterial.uniforms.uTime.value = time;
  }
  
  stars.rotation.y += 0.00002;
  
  const hours = Math.floor((t * 100) % 24);
  const minutes = Math.floor((t * 6000) % 60);
  timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  const temp = 18 + Math.sin(t * 0.001) * 8;
  temperatureEl.textContent = `${Math.round(temp)}°C`;
  
  composer.render();
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
  resizeVisCanvas();
}
window.addEventListener('resize', onResize);

audio.addEventListener('canplaythrough', () => {
  loading.classList.add('hidden');
  setTimeout(() => loading.remove(), 500);
});

setTimeout(() => {
  if (!loading.classList.contains('hidden')) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);
  }
}, 3000);

requestAnimationFrame(animate);