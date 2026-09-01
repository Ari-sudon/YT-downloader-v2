import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('cityCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 40, 120);
camera.lookAt(0, 0, 0);

const buildingGroup = new THREE.Group();
scene.add(buildingGroup);

const buildingData = [];
const BUILDING_COUNT = 120;
const CITY_RADIUS = 400;
const ROTATION_SPEED = 0.00008;

const buildingColors = [
  0x0a0a1a, 0x10102a, 0x1a1020, 0x0d1a1a, 0x1a150d,
  0x150d1a, 0x0d1a15, 0x1a0d0d, 0x0f0f1f, 0x1a1a0d
];

const windowColors = [
  0xffd700, 0xffffcc, 0xffeb99, 0xffcc66, 0xffaa33,
  0x00ffff, 0x66ffff, 0x99ffff, 0xff6699, 0xff99cc
];

function createBuilding(x, z, index) {
  const width = 12 + Math.random() * 28;
  const depth = 12 + Math.random() * 28;
  const height = 40 + Math.random() * 180;
  
  const baseGeometry = new THREE.BoxGeometry(width, height, depth);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
    roughness: 0.85,
    metalness: 0.1,
  });
  const building = new THREE.Mesh(baseGeometry, baseMaterial);
  building.position.set(x, height / 2, z);
  building.castShadow = true;
  building.receiveShadow = true;

  const windowGeometry = new THREE.PlaneGeometry(1, 1);
  const windows = new THREE.Group();
  
  const rows = Math.floor(height / 4);
  const colsW = Math.floor(width / 3);
  const colsD = Math.floor(depth / 3);
  
  for (let side = 0; side < 4; side++) {
    const cols = side % 2 === 0 ? colsW : colsD;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() < 0.7) {
          const windowMat = new THREE.MeshBasicMaterial({
            color: windowColors[Math.floor(Math.random() * windowColors.length)],
            transparent: true,
            opacity: 0.3 + Math.random() * 0.5,
            side: THREE.DoubleSide,
          });
          const win = new THREE.Mesh(windowGeometry, windowMat);
          
          const y = -height / 2 + 3 + row * 4;
          const offset = (cols - 1) * 1.5 / 2;
          
          if (side === 0) {
            win.position.set(-width / 2 + 0.01, y, -offset + col * 1.5);
            win.rotation.y = Math.PI / 2;
          } else if (side === 1) {
            win.position.set(width / 2 - 0.01, y, offset - col * 1.5);
            win.rotation.y = -Math.PI / 2;
          } else if (side === 2) {
            win.position.set(-offset + col * 1.5, y, depth / 2 - 0.01);
          } else {
            win.position.set(offset - col * 1.5, y, -depth / 2 + 0.01);
            win.rotation.y = Math.PI;
          }
          
          win.userData = { 
            baseOpacity: windowMat.opacity,
            flickerSpeed: 0.5 + Math.random() * 2,
            flickerOffset: Math.random() * Math.PI * 2,
          };
          windows.add(win);
        }
      }
    }
  }
  
  building.add(windows);
  
  const antennaChance = Math.random();
  let antenna = null;
  if (antennaChance < 0.3 && height > 80) {
    const antGeom = new THREE.CylinderGeometry(0.15, 0.3, 8 + Math.random() * 12, 4);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.7 });
    antenna = new THREE.Mesh(antGeom, antMat);
    antenna.position.set(0, height / 2 + 5, 0);
    building.add(antenna);
  }
  
  const angle = Math.atan2(z, x);
  const distance = Math.sqrt(x * x + z * z);
  
  buildingData.push({
    mesh: building,
    windows,
    antenna,
    angle,
    distance,
    baseHeight: height,
    rotationOffset: Math.random() * Math.PI * 2,
    swayAmount: 0.002 + Math.random() * 0.004,
  });
  
  buildingGroup.add(building);
}

for (let i = 0; i < BUILDING_COUNT; i++) {
  const angle = (i / BUILDING_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
  const distance = CITY_RADIUS * 0.3 + Math.random() * CITY_RADIUS * 0.7;
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  createBuilding(x, z, i);
}

const ambientLight = new THREE.AmbientLight(0x222233, 1.5);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x88aaff, 0.8);
moonLight.position.set(100, 200, 50);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 10;
moonLight.shadow.camera.far = 500;
moonLight.shadow.camera.left = -200;
moonLight.shadow.camera.right = 200;
moonLight.shadow.camera.top = 200;
moonLight.shadow.camera.bottom = -200;
moonLight.shadow.bias = -0.001;
scene.add(moonLight);

const rimLight = new THREE.DirectionalLight(0xff6699, 0.15);
rimLight.position.set(-100, 50, -100);
scene.add(rimLight);

const fogColor = new THREE.Color(0x050515);
scene.fog = new THREE.FogExp2(fogColor, 0.0015);

const particleCount = 3000;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);
const particleAlphas = new Float32Array(particleCount);
const particleColors = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  const radius = 50 + Math.random() * 500;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  
  particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  particlePositions[i * 3 + 1] = Math.random() * 300;
  particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  
  particleSizes[i] = 0.5 + Math.random() * 2;
  particleAlphas[i] = 0.1 + Math.random() * 0.4;
  
  const colorChoice = Math.random();
  if (colorChoice < 0.4) {
    particleColors[i * 3] = 1;
    particleColors[i * 3 + 1] = 0.9;
    particleColors[i * 3 + 2] = 0.6;
  } else if (colorChoice < 0.7) {
    particleColors[i * 3] = 0;
    particleColors[i * 3 + 1] = 1;
    particleColors[i * 3 + 2] = 1;
  } else {
    particleColors[i * 3] = 1;
    particleColors[i * 3 + 1] = 0.4;
    particleColors[i * 3 + 2] = 0.6;
  }
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(particleAlphas, 1));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

const particleMaterial = new THREE.PointsMaterial({
  size: 1,
  vertexColors: true,
  transparent: true,
  opacity: 1,
  sizeAttenuation: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const starGeometry = new THREE.BufferGeometry();
const starCount = 800;
const starPositions = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);

for (let i = 0; i < starCount; i++) {
  const radius = 800 + Math.random() * 400;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + 200;
  starPositions[i * 3 + 2] = radius * Math.cos(phi);
  starSizes[i] = 0.5 + Math.random() * 1.5;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
  depthWrite: false,
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

let time = 0;
let mouseX = 0;
let mouseY = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.016;
  
  buildingGroup.rotation.y += ROTATION_SPEED;
  
  buildingData.forEach((data, i) => {
    const sway = Math.sin(time * 0.5 + data.rotationOffset) * data.swayAmount * data.distance;
    data.mesh.rotation.z = sway * 0.1;
    data.mesh.rotation.x = sway * 0.05;
    
    if (data.windows) {
      data.windows.children.forEach((win) => {
        const ud = win.userData;
        const flicker = Math.sin(time * ud.flickerSpeed + ud.flickerOffset) * 0.3 + 0.7;
        win.material.opacity = ud.baseOpacity * flicker;
      });
    }
    
    if (data.antenna) {
      data.antenna.rotation.z = Math.sin(time * 0.3 + data.rotationOffset) * 0.02;
      data.antenna.rotation.x = Math.cos(time * 0.4 + data.rotationOffset) * 0.02;
    }
  });
  
  const targetX = mouseX * 15;
  const targetY = mouseY * 10;
  camera.position.x += (targetX - camera.position.x) * 0.02;
  camera.position.y += (targetY + 40 - camera.position.y) * 0.02;
  camera.lookAt(targetX * 0.3, 0, targetY * 0.3);
  
  particles.rotation.y += 0.00003;
  particles.rotation.x = Math.sin(time * 0.1) * 0.02;
  
  const particlePos = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    particlePos[i * 3 + 1] += Math.sin(time + i) * 0.005;
    if (particlePos[i * 3 + 1] > 350) particlePos[i * 3 + 1] = 0;
    if (particlePos[i * 3 + 1] < 0) particlePos[i * 3 + 1] = 350;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  
  stars.rotation.y += 0.00001;
  
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

document.addEventListener('mousemove', (e) => {
  const cards = document.querySelectorAll('.glass-card:not(.hidden)');
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (y / rect.height) * -8;
    const rotateY = (x / rect.width) * 8;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
});

document.addEventListener('mouseleave', () => {
  const cards = document.querySelectorAll('.glass-card:not(.hidden)');
  cards.forEach(card => {
    card.style.transform = '';
  });
});

const themeToggle = document.getElementById('themeToggle');
const infoToggle = document.getElementById('infoToggle');
const infoModal = document.getElementById('infoModal');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.style.transform = 'scale(0.9) rotate(180deg)';
  setTimeout(() => themeToggle.style.transform = '', 300);
});

infoToggle.addEventListener('click', () => {
  infoModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});

function closeModal() {
  infoModal.classList.add('hidden');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !infoModal.classList.contains('hidden')) closeModal();
});

const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const infoCard = document.getElementById('infoCard');
const formatCard = document.getElementById('formatCard');
const downloadCard = document.getElementById('downloadCard');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoTitle = document.getElementById('videoTitle');
const channelName = document.getElementById('channelName');
const channelAvatar = document.getElementById('channelAvatar');
const viewCount = document.getElementById('viewCount');
const durationBadge = document.getElementById('durationBadge');
const videoQualities = document.getElementById('videoQualities');
const audioQualities = document.getElementById('audioQualities');
const formatTabs = document.querySelectorAll('.format-tab');
const formatPanels = document.querySelectorAll('.format-panel');
const downloadProgress = document.getElementById('downloadProgress');
const downloadComplete = document.getElementById('downloadComplete');
const downloadError = document.getElementById('downloadError');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const progressDetails = document.getElementById('progressDetails');
const progressFill = document.getElementById('progressFill');
const saveBtn = document.getElementById('saveBtn');
const downloadAnother = document.getElementById('downloadAnother');
const retryBtn = document.getElementById('retryBtn');
const errorMessage = document.getElementById('errorMessage');
const playPreview = document.getElementById('playPreview');

let currentVideoInfo = null;
let selectedFormat = null;

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/playlist\?list=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function formatBytes(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
  return bytes + ' B';
}

async function fetchVideoInfo(videoId) {
  try {
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (!response.ok) throw new Error('Failed to fetch video info');
    const data = await response.json();
    
    return {
      id: videoId,
      title: data.title,
      author_name: data.author_name,
      author_url: data.author_url,
      thumbnail_url: data.thumbnail_url,
      duration: 0,
      view_count: 0,
    };
  } catch (error) {
    return {
      id: videoId,
      title: 'YouTube Video',
      author_name: 'Unknown Channel',
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      view_count: 0,
    };
  }
}

function generateMockFormats() {
  const videoFormats = [
    { quality: '4K', resolution: '3840×2160', codec: 'VP9', ext: 'webm', size: 450 * 1024 * 1024, itag: 313 },
    { quality: '1440p', resolution: '2560×1440', codec: 'VP9', ext: 'webm', size: 280 * 1024 * 1024, itag: 271 },
    { quality: '1080p', resolution: '1920×1080', codec: 'H.264', ext: 'mp4', size: 180 * 1024 * 1024, itag: 137 },
    { quality: '720p', resolution: '1280×720', codec: 'H.264', ext: 'mp4', size: 95 * 1024 * 1024, itag: 136 },
    { quality: '480p', resolution: '854×480', codec: 'H.264', ext: 'mp4', size: 45 * 1024 * 1024, itag: 135 },
    { quality: '360p', resolution: '640×360', codec: 'H.264', ext: 'mp4', size: 25 * 1024 * 1024, itag: 134 },
  ];
  
  const audioFormats = [
    { quality: 'High', bitrate: '256 kbps', codec: 'AAC', ext: 'm4a', size: 12 * 1024 * 1024, itag: 140 },
    { quality: 'Medium', bitrate: '128 kbps', codec: 'AAC', ext: 'm4a', size: 6 * 1024 * 1024, itag: 139 },
    { quality: 'Low', bitrate: '48 kbps', codec: 'AAC', ext: 'm4a', size: 2.5 * 1024 * 1024, itag: 141 },
    { quality: 'Opus High', bitrate: '160 kbps', codec: 'Opus', ext: 'opus', size: 8 * 1024 * 1024, itag: 251 },
    { quality: 'Opus Medium', bitrate: '128 kbps', codec: 'Opus', ext: 'opus', size: 6 * 1024 * 1024, itag: 250 },
    { quality: 'Opus Low', bitrate: '48 kbps', codec: 'Opus', ext: 'opus', size: 2.5 * 1024 * 1024, itag: 249 },
  ];
  
  return { videoFormats, audioFormats };
}

function renderQualityOptions(formats, container, type) {
  container.innerHTML = '';
  
  formats.forEach((format, index) => {
    const btn = document.createElement('button');
    btn.className = 'quality-option';
    btn.dataset.itag = format.itag;
    btn.dataset.type = type;
    
    if (type === 'video') {
      btn.innerHTML = `
        <span class="quality-label">${format.quality}</span>
        <span class="quality-detail">${format.resolution} • ${format.codec}</span>
        <span class="quality-size">${format.ext.toUpperCase()} • ~${formatBytes(format.size)}</span>
      `;
    } else {
      btn.innerHTML = `
        <span class="quality-label">${format.quality}</span>
        <span class="quality-detail">${format.bitrate} • ${format.codec}</span>
        <span class="quality-size">${format.ext.toUpperCase()} • ~${formatBytes(format.size)}</span>
      `;
    }
    
    btn.addEventListener('click', () => selectFormat(btn, format, type));
    container.appendChild(btn);
  });
}

function selectFormat(btn, format, type) {
  document.querySelectorAll('.quality-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedFormat = { ...format, type };
  
  startDownload();
}

function showCard(card) {
  card.classList.remove('hidden');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = '';
}

function hideCard(card) {
  card.classList.add('hidden');
}

urlInput.addEventListener('input', () => {
  const url = urlInput.value.trim();
  const videoId = extractVideoId(url);
  
  if (videoId) {
    urlInput.classList.add('valid');
    fetchBtn.disabled = false;
  } else {
    urlInput.classList.remove('valid');
    fetchBtn.disabled = true;
  }
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !fetchBtn.disabled) {
    handleFetch();
  }
});

fetchBtn.addEventListener('click', handleFetch);

async function handleFetch() {
  const url = urlInput.value.trim();
  const videoId = extractVideoId(url);
  
  if (!videoId) return;
  
  fetchBtn.classList.add('loading');
  fetchBtn.disabled = true;
  
  try {
    const info = await fetchVideoInfo(videoId);
    currentVideoInfo = info;
    
    videoThumbnail.src = info.thumbnail_url;
    videoTitle.textContent = info.title;
    channelName.textContent = info.author_name;
    viewCount.textContent = info.view_count ? formatNumber(info.view_count) + ' views' : 'Unknown views';
    durationBadge.textContent = info.duration ? formatDuration(info.duration) : 'LIVE';
    
    hideCard(infoCard);
    hideCard(formatCard);
    hideCard(downloadCard);
    showCard(infoCard);
    showCard(formatCard);
    
    const { videoFormats, audioFormats } = generateMockFormats();
    renderQualityOptions(videoFormats, videoQualities, 'video');
    renderQualityOptions(audioFormats, audioQualities, 'audio');
    
    urlInput.style.borderColor = 'var(--success)';
    setTimeout(() => urlInput.style.borderColor = '', 2000);
    
  } catch (error) {
    console.error('Fetch error:', error);
    urlInput.style.borderColor = 'var(--error)';
    setTimeout(() => urlInput.style.borderColor = '', 2000);
  } finally {
    fetchBtn.classList.remove('loading');
    fetchBtn.disabled = false;
  }
}

formatTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    formatTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    formatPanels.forEach(p => p.classList.add('hidden'));
    
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    
    const format = tab.dataset.format;
    document.getElementById(`${format}Panel`).classList.remove('hidden');
  });
});

function startDownload() {
  if (!selectedFormat || !currentVideoInfo) return;
  
  hideCard(downloadProgress);
  hideCard(downloadComplete);
  hideCard(downloadError);
  showCard(downloadCard);
  showCard(downloadProgress);
  
  progressPercent.textContent = '0%';
  progressStatus.textContent = 'Preparing download...';
  progressDetails.textContent = `${selectedFormat.quality} ${selectedFormat.type === 'video' ? 'Video' : 'Audio'} • ${selectedFormat.ext.toUpperCase()}`;
  progressFill.style.width = '0%';
  
  const progressCircle = document.querySelector('.progress-fill');
  progressCircle.style.strokeDashoffset = '226';
  
  simulateDownload();
}

function simulateDownload() {
  let progress = 0;
  const stages = [
    { progress: 10, status: 'Connecting to YouTube...', delay: 800 },
    { progress: 25, status: 'Fetching video stream...', delay: 1200 },
    { progress: 45, status: 'Processing stream...', delay: 1500 },
    { progress: 70, status: 'Assembling file...', delay: 1000 },
    { progress: 90, status: 'Finalizing...', delay: 600 },
    { progress: 100, status: 'Download ready!', delay: 300 },
  ];
  
  let stageIndex = 0;
  
  function nextStage() {
    if (stageIndex >= stages.length) {
      completeDownload();
      return;
    }
    
    const stage = stages[stageIndex];
    const startProgress = progress;
    const startTime = Date.now();
    const duration = stage.delay;
    
    function animateProgress() {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      progress = startProgress + (stage.progress - startProgress) * eased;
      
      updateProgress(progress, stage.status);
      
      if (t < 1) {
        requestAnimationFrame(animateProgress);
      } else {
        stageIndex++;
        nextStage();
      }
    }
    
    animateProgress();
  }
  
  nextStage();
}

function updateProgress(percent, status) {
  progressPercent.textContent = Math.round(percent) + '%';
  progressStatus.textContent = status;
  progressFill.style.width = percent + '%';
  
  const circle = document.querySelector('.progress-fill');
  const offset = 226 * (1 - percent / 100);
  circle.style.strokeDashoffset = offset;
}

function completeDownload() {
  hideCard(downloadProgress);
  showCard(downloadComplete);
  
  const fileName = `${sanitizeFilename(currentVideoInfo.title)}.${selectedFormat.ext}`;
  saveBtn.setAttribute('download', fileName);
  saveBtn.href = generateMockDownloadUrl(selectedFormat);
}

function generateMockDownloadUrl(format) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(
    `YT Glass Download\n\n` +
    `Title: ${currentVideoInfo.title}\n` +
    `Format: ${format.quality} ${format.type === 'video' ? 'Video' : 'Audio'}\n` +
    `Codec: ${format.codec}\n` +
    `Container: ${format.ext}\n` +
    `Size: ~${formatBytes(format.size)}\n\n` +
    `Note: This is a demo. Actual YouTube downloading requires a backend service ` +
    `due to CORS restrictions and YouTube's Terms of Service.\n` +
    `For real downloads, use yt-dlp or a similar tool.`
  )}`;
}

function sanitizeFilename(str) {
  return str.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
}

downloadAnother.addEventListener('click', () => {
  resetAll();
});

retryBtn.addEventListener('click', () => {
  hideCard(downloadError);
  showCard(downloadProgress);
  simulateDownload();
});

function resetAll() {
  currentVideoInfo = null;
  selectedFormat = null;
  
  urlInput.value = '';
  urlInput.classList.remove('valid');
  fetchBtn.disabled = true;
  
  hideCard(infoCard);
  hideCard(formatCard);
  hideCard(downloadCard);
  
  document.querySelectorAll('.quality-option').forEach(b => b.classList.remove('selected'));
  formatTabs[0].click();
}

playPreview.addEventListener('click', () => {
  if (currentVideoInfo) {
    window.open(`https://www.youtube.com/watch?v=${currentVideoInfo.id}`, '_blank');
  }
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (prefersReducedMotion.matches) {
  document.documentElement.style.setProperty('--transition-bounce', '0ms');
}