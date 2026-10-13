// game.js - Main game loop and state management

import { Track } from './track.js';
import { Car } from './car.js';
import { AIController } from './ai.js';
import { HUD, formatTime } from './hud.js';
import { AudioEngine } from './audio.js';

const WORLD_W = 1600;
const WORLD_H = 900;
const TOTAL_LAPS = 3;

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.hudCanvas = document.getElementById('hudCanvas');
    this.hud = new HUD(this.hudCanvas);
    this.audio = new AudioEngine();

    this.state = 'menu'; // menu | countdown | racing | finished
    this.keys = {};
    this.lastTime = 0;
    this.elapsed = 0;
    this.startTime = 0;
    this.bestLap = Infinity;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.finishResults = [];

    this.track = null;
    this.player = null;
    this.aiCars = [];
    this.allCars = [];
    this.aiControllers = [];

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.camScale = 1;

    this._bindEvents();
    this._resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (this.state === 'menu') {
        if (e.code === 'Space' || e.code === 'Enter') this.startGame();
      }
      if (this.state === 'finished') {
        if (e.code === 'Space' || e.code === 'Enter') this.showMenu();
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('resize', () => this._resize());

    // UI buttons
    document.getElementById('btnStart').addEventListener('click', () => this.startGame());
    document.getElementById('btnRestart').addEventListener('click', () => this.startGame());
    document.getElementById('btnMenu').addEventListener('click', () => this.showMenu());
  }

  _resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.canvas.width = W;
    this.canvas.height = H;
    this.hudCanvas.width = W;
    this.hudCanvas.height = H;
    this.hud.resize(W, H);

    // Compute scale so the whole world fits
    this.camScale = Math.min(W / WORLD_W, H / WORLD_H);
  }

  startGame() {
    this.audio.init();
    this.audio.resume();

    // Hide menu, show game
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('finishScreen').classList.add('hidden');
    document.getElementById('gameWrapper').classList.remove('hidden');

    // Init track
    this.track = new Track();
    this.track.preRender(WORLD_W, WORLD_H);

    // Init cars
    const pts = this.track.points;
    const norm = this.track.normals[0];
    const placeOffset = this.track.width * 0.4;

    this.player = new Car(this.track, 'player', true);
    this.player.x = pts[0].x + norm.x * placeOffset * 0;
    const nextP = pts[1];
    this.player.angle = Math.atan2(nextP.y - pts[0].y, nextP.x - pts[0].x);

    this.aiCars = [];
    this.aiControllers = [];
    const aiKeys = ['ai1', 'ai2', 'ai3'];
    for (let i = 0; i < 3; i++) {
      const ai = new Car(this.track, aiKeys[i], false);
      // Stagger starting positions
      const lag = (i + 1) * (this.track.totalPoints / 60);
      const startIdx = Math.max(0, Math.floor(lag));
      ai.x = pts[(pts.length - Math.floor((i + 1) * 8)) % pts.length].x + norm.x * (i % 2 === 0 ? placeOffset : -placeOffset);
      ai.y = pts[(pts.length - Math.floor((i + 1) * 8)) % pts.length].y + norm.y * (i % 2 === 0 ? placeOffset : -placeOffset);
      ai.angle = this.player.angle;
      this.aiCars.push(ai);
      this.aiControllers.push(new AIController(ai, this.track));
    }

    this.allCars = [this.player, ...this.aiCars];
    this.allCars.forEach(c => { c.track = this.track; });

    // State
    this.state = 'countdown';
    this.countdown = 3;
    this.countdownTimer = 0;
    this.elapsed = 0;
    this.startTime = 0;
    this.bestLap = Infinity;
    this.finishResults = [];
    this.hud.notifications = [];
  }

  showMenu() {
    document.getElementById('menuScreen').classList.remove('hidden');
    document.getElementById('finishScreen').classList.add('hidden');
    document.getElementById('gameWrapper').classList.add('hidden');
    this.state = 'menu';
  }

  _processInput() {
    const p = this.player;
    p.throttle = 0;
    p.steering = 0;

    if (this.keys['ArrowUp'] || this.keys['KeyW']) p.throttle = 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) p.throttle = -1;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) p.steering = -1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) p.steering = 1;
  }

  _updateCamera() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const targetX = this.player.x - W / (2 * this.camScale);
    const targetY = this.player.y - H / (2 * this.camScale);
    // Clamp
    const maxX = WORLD_W - W / this.camScale;
    const maxY = WORLD_H - H / this.camScale;
    this.camX += (Math.max(0, Math.min(maxX, targetX)) - this.camX) * 0.1;
    this.camY += (Math.max(0, Math.min(maxY, targetY)) - this.camY) * 0.1;
  }

  _checkRaceEvents() {
    for (const car of this.allCars) {
      const lapCompleted = car.checkCheckpoint(this.track.checkpoints);
      if (lapCompleted) {
        if (car.isPlayer) {
          // Check lap time
          const lapTime = car.lapTimes[car.lapTimes.length - 1];
          if (lapTime && lapTime < this.bestLap) {
            this.bestLap = lapTime;
            this.hud.addNotification('🏆 BEST LAP!', '#ffaa00');
          }
          if (car.lap <= TOTAL_LAPS) {
            this.hud.addNotification(`LAP ${Math.min(car.lap, TOTAL_LAPS)} COMPLETE!`, '#00ffff');
            this.audio.playLapComplete();
          }
        }
        // Check finish
        if (car.lap >= TOTAL_LAPS && !car.finished) {
          car.finished = true;
          this.finishResults.push(car);
          if (car.isPlayer) {
            this.audio.playFinish();
            setTimeout(() => this._showFinish(), 2000);
          }
        }
      }
    }
  }

  _showFinish() {
    this.state = 'finished';
    const sorted = [...this.allCars].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return this.finishResults.indexOf(a) - this.finishResults.indexOf(b);
      const pa = a.lap * 10000 + a.closestIdx;
      const pb = b.lap * 10000 + b.closestIdx;
      return pb - pa;
    });

    const playerPos = sorted.indexOf(this.player) + 1;
    const posText = ['', '1ST 🥇', '2ND 🥈', '3RD 🥉', '4TH'][playerPos] || `${playerPos}TH`;

    document.getElementById('resultPosition').textContent = posText;
    document.getElementById('resultTime').textContent = formatTime(this.elapsed);
    document.getElementById('resultBestLap').textContent = formatTime(this.bestLap);

    const tbody = document.getElementById('resultTableBody');
    tbody.innerHTML = '';
    sorted.forEach((car, i) => {
      const tr = document.createElement('tr');
      const name = car.isPlayer ? '🚗 YOU' : `🤖 AI ${i}`;
      const time = formatTime(car.lapTimes.reduce((a, b) => a + b, 0));
      const bestL = formatTime(Math.min(...(car.lapTimes.length ? car.lapTimes : [0])));
      tr.innerHTML = `<td>${i + 1}</td><td>${name}</td><td>${time}</td><td>${bestL}</td>`;
      if (car.isPlayer) tr.classList.add('player-row');
      tbody.appendChild(tr);
    });

    document.getElementById('gameWrapper').classList.add('hidden');
    document.getElementById('finishScreen').classList.remove('hidden');
  }

  _drawBackground(ctx) {
    // Starfield / background
    ctx.save();
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  _loop(timestamp) {
    const dt = Math.min(32, timestamp - this.lastTime) / 16.67;
    this.lastTime = timestamp;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);
    this._drawBackground(ctx);

    if (this.state === 'countdown') {
      this.countdownTimer += dt;
      if (this.countdownTimer > 60) {
        this.countdown--;
        this.countdownTimer = 0;
        if (this.countdown < 0) {
          this.state = 'racing';
          this.startTime = performance.now();
        }
      }

      // Render static scene during countdown
      this._renderWorld(ctx);
      const hudCtx = this.hudCanvas.getContext('2d');
      hudCtx.clearRect(0, 0, W, H);
      this.hud.drawCountdown(this.countdown);
    }

    if (this.state === 'racing') {
      this.elapsed = performance.now() - this.startTime;

      // Input
      this._processInput();

      // Update AI
      this.aiControllers.forEach(ai => ai.update());

      // Update cars
      this.allCars.forEach(car => car.update(this.keys, dt));

      // Camera
      this._updateCamera();

      // Check race events
      this._checkRaceEvents();

      // Audio
      this.audio.setEngineRPM(this.player.speed, this.player.maxSpeed);

      // Render
      this._renderWorld(ctx);

      // HUD
      const hudCtx = this.hudCanvas.getContext('2d');
      hudCtx.clearRect(0, 0, W, H);
      this.hud.update();
      this.hud.draw(this.player, this.allCars, this.elapsed, this.bestLap < Infinity ? this.bestLap : 0);
    }

    if (this.state === 'finished') {
      // Still render the world frozen
      this._renderWorld(ctx);
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  _renderWorld(ctx) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const scale = this.camScale;

    ctx.save();
    // Apply camera transform
    ctx.scale(scale, scale);
    ctx.translate(-this.camX, -this.camY);

    // Draw track
    if (this.track) {
      ctx.drawImage(this.track._trackCanvas, 0, 0);
    }

    // Draw cars
    if (this.allCars) {
      this.allCars.forEach(car => car.draw(ctx));
    }

    ctx.restore();
  }
}

// Start game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
