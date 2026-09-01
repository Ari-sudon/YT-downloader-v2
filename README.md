# Neon Tokyo Nights - 3D City Experience

A immersive 3D night Tokyo cityscape with liquid glass UI, ambient audio visualization, and dynamic weather effects.

## Features

- **3D City Generation**: Procedural buildings with windows, neon signs, and hero structures
- **Liquid Glass UI**: Translucent frosted glass panels with backdrop blur
- **Audio Visualizer**: Real-time frequency visualization using Web Audio API
- **Dynamic Weather**: Toggle rain, fog, and neon bloom effects
- **Orbiting Camera**: Smooth cinematic camera movement around the city
- **Particle Systems**: Floating ambient particles and optional rain
- **Post-Processing**: Bloom, FXAA anti-aliasing, and tone mapping

## Adding Music

Place your audio files in the `music/` folder:

```
music/
├── track.mp3      (or track.ogg)
├── track2.mp3
└── track3.mp3
```

Supported formats: MP3, OGG, WAV

The app will automatically load `track.mp3` on startup. Use the UI controls to play/pause, skip tracks, and adjust volume.

## Getting Free Music

- **Free Music Archive**: https://freemusicarchive.org/
- **Pixabay Music**: https://pixabay.com/music/
- **Incompetech**: https://incompetech.com/music/
- **StreamBeats** (by Harris Heller): https://streambeads.com/

Look for: lofi, synthwave, ambient, chillhop, or cyberpunk genres

## Controls

- **Mouse Drag**: Orbit camera
- **Scroll**: Zoom in/out
- **Right Click + Drag**: Pan
- **UI Panel**: Audio controls, weather toggles, city stats

## Browser Requirements

- Modern browser with WebGL2 support
- Web Audio API support
- ES6 Modules support

## Running Locally

Due to ES6 modules and CORS, you need a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000`

## Performance Tips

- Reduce `particleCount` in app.js for lower-end devices
- Disable bloom (`neonToggle`) for better performance
- Lower `renderer.setPixelRatio` for high-DPI displays# Youtube
