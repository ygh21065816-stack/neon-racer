// car.js - Car physics and rendering

import { TRACK_WIDTH } from './track.js';

const COLORS = {
  player: { body: '#00ffff', glow: '#00ffff', accent: '#ffffff' },
  ai1:    { body: '#ff006e', glow: '#ff006e', accent: '#ffcc00' },
  ai2:    { body: '#8338ec', glow: '#8338ec', accent: '#ff006e' },
  ai3:    { body: '#fb5607', glow: '#fb5607', accent: '#ffffff' },
};

class Car {
  constructor(track, colorKey = 'player', isPlayer = false) {
    this.track = track;
    this.colorKey = colorKey;
    this.colors = COLORS[colorKey] || COLORS.player;
    this.isPlayer = isPlayer;

    // Position & physics
    const startPt = track.points[0];
    const startNorm = track.normals[0];
    const offset = isPlayer ? 0 : (Math.random() - 0.5) * 40;
    this.x = startPt.x + startNorm.x * offset;
    this.y = startPt.y + startNorm.y * offset;

    // Start angle from track direction
    const next = track.points[1];
    this.angle = Math.atan2(next.y - startPt.y, next.x - startPt.x);

    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.angularVel = 0;

    // Car dimensions
    this.width = 22;
    this.height = 38;

    // Physics params
    this.maxSpeed = isPlayer ? 7.5 : 5.5 + Math.random() * 1.5;
    this.acceleration = isPlayer ? 0.18 : 0.12;
    this.braking = 0.25;
    this.friction = 0.96;
    this.turnSpeed = 0.055;
    this.offTrackFriction = 0.85;

    // State
    this.throttle = 0;   // -1 to 1
    this.steering = 0;   // -1 to 1
    this.onTrack = true;
    this.drifting = false;

    // Race state
    this.lap = 0;
    this.checkpoint = 0;
    this.totalCheckpoints = track.checkpoints.length;
    this.lapTimes = [];
    this.currentLapStart = 0;
    this.finished = false;
    this.position = 1;

    // Track progress
    this.trackProgress = 0; // continuous progress along track (for sorting)
    this.closestIdx = 0;

    // Trail
    this.trail = [];
    this.maxTrail = 60;

    // Particles
    this.particles = [];

    // Boost
    this.boostTimer = 0;

    // Collision
    this.radius = 18;
  }

  update(keys, dt) {
    if (this.finished) return;

    // Update position on track
    this.closestIdx = this.track.getClosestPointIndex(this.x, this.y);
    this.onTrack = this.track.isOnTrack(this.x, this.y);

    // Apply throttle/steering (set by player or AI)
    const speedFactor = 1 - Math.abs(this.speed) / (this.maxSpeed * 1.5);
    const turnFactor = Math.max(0.2, Math.abs(this.speed) / this.maxSpeed);

    // Steering
    this.angle += this.steering * this.turnSpeed * turnFactor * (this.speed > 0 ? 1 : -1);

    // Acceleration
    if (this.throttle > 0) {
      this.speed += this.acceleration * this.throttle;
    } else if (this.throttle < 0) {
      if (this.speed > 0.5) {
        this.speed -= this.braking * Math.abs(this.throttle);
      } else {
        this.speed += this.acceleration * 0.5 * this.throttle;
      }
    }

    // Clamp speed
    const currentMax = this.onTrack ? this.maxSpeed : this.maxSpeed * 0.5;
    this.speed = Math.max(-currentMax * 0.4, Math.min(currentMax, this.speed));

    // Friction
    const fric = this.onTrack ? this.friction : this.offTrackFriction;
    this.speed *= fric;

    // Drift detection
    this.drifting = Math.abs(this.steering) > 0.5 && Math.abs(this.speed) > 3;

    // Move
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Track progress
    this.trackProgress = this.lap * this.track.totalPoints + this.closestIdx;

    // Update trail
    if (Math.abs(this.speed) > 0.5) {
      this.trail.push({ x: this.x, y: this.y, alpha: 1.0 });
    }
    if (this.trail.length > this.maxTrail) this.trail.shift();
    this.trail.forEach(t => t.alpha *= 0.96);

    // Emit particles when drifting or accelerating hard
    if (this.drifting || (this.throttle > 0.8 && this.speed > 4)) {
      this._emitParticle();
    }

    // Update particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 2;
      p.alpha = p.life / 100;
    });

    // Boost cooldown
    if (this.boostTimer > 0) this.boostTimer--;
  }

  _emitParticle() {
    // Emit from back of car
    const bx = this.x - Math.cos(this.angle) * this.height / 2;
    const by = this.y - Math.sin(this.angle) * this.height / 2;
    const spread = 0.5;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: bx + (Math.random() - 0.5) * 8,
        y: by + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.5 - Math.cos(this.angle) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - Math.sin(this.angle) * 1.5,
        life: 80 + Math.random() * 20,
        alpha: 1,
        size: 3 + Math.random() * 4,
        color: this.drifting ? '#ffff00' : this.colors.glow,
      });
    }
  }

  checkCheckpoint(checkpoints) {
    const cp = checkpoints[this.checkpoint];
    const dx = this.x - cp.x;
    const dy = this.y - cp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < TRACK_WIDTH + 10) {
      this.checkpoint = (this.checkpoint + 1) % checkpoints.length;
      if (this.checkpoint === 0) {
        // Completed a lap
        this.lap++;
        const now = performance.now();
        if (this.currentLapStart > 0) {
          this.lapTimes.push(now - this.currentLapStart);
        }
        this.currentLapStart = now;
        return true; // lap completed
      }
    }
    return false;
  }

  draw(ctx) {
    // Draw trail
    this._drawTrail(ctx);

    // Draw particles
    this._drawParticles(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    const w = this.width;
    const h = this.height;

    // Car glow
    ctx.shadowColor = this.colors.glow;
    ctx.shadowBlur = this.boostTimer > 0 ? 30 : 15;

    // Car body
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 5);
    ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, -h / 2 + 6, w - 8, h * 0.3, 3);
    ctx.fill();

    // Accent stripe
    ctx.fillStyle = this.colors.accent;
    ctx.fillRect(-2, -h / 2 + 2, 4, h - 4);

    // Headlights
    ctx.fillStyle = '#ffffaa';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-w / 2 + 5, -h / 2 + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 - 5, -h / 2 + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Tail lights
    ctx.fillStyle = '#ff2200';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-w / 2 + 5, h / 2 - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 - 5, h / 2 - 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Exhaust flame when accelerating fast
    if (this.speed > this.maxSpeed * 0.7 && this.throttle > 0.5) {
      this._drawFlame(ctx, w, h);
    }

    ctx.restore();
  }

  _drawFlame(ctx, w, h) {
    const flameLen = 10 + Math.random() * 12;
    ctx.save();
    const grad = ctx.createLinearGradient(0, h / 2, 0, h / 2 + flameLen);
    grad.addColorStop(0, 'rgba(255,200,0,0.9)');
    grad.addColorStop(0.5, 'rgba(255,80,0,0.6)');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 15;
    // Left exhaust
    ctx.beginPath();
    ctx.ellipse(-w / 4, h / 2 + flameLen / 2, 4, flameLen / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right exhaust
    ctx.beginPath();
    ctx.ellipse(w / 4, h / 2 + flameLen / 2, 4, flameLen / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawTrail(ctx) {
    if (this.trail.length < 2) return;
    for (let i = 1; i < this.trail.length; i++) {
      const prev = this.trail[i - 1];
      const curr = this.trail[i];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = `rgba(${this.drifting ? '255,200,0' : '100,150,255'},${curr.alpha * 0.4})`;
      ctx.lineWidth = this.drifting ? 8 : 4;
      ctx.stroke();
    }
  }

  _drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

export { Car, COLORS };
