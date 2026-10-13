// hud.js - HUD rendering

function formatTime(ms) {
  if (!ms || ms <= 0) return '--:--.---';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const msec = Math.floor(ms % 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(msec).padStart(3, '0')}`;
}

function formatSpeed(speed) {
  return Math.round(Math.abs(speed) * 40); // convert to km/h feel
}

class HUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.totalLaps = 3;

    // Notification queue
    this.notifications = [];
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  addNotification(text, color = '#00ffff') {
    this.notifications.push({ text, color, life: 150, maxLife: 150 });
  }

  update() {
    this.notifications = this.notifications.filter(n => n.life > 0);
    this.notifications.forEach(n => n.life--);
  }

  draw(player, allCars, elapsed, bestLap) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    // ---------- Top bar ----------
    // Lap counter
    this._drawPanel(ctx, w / 2 - 120, 12, 240, 56, '#00ffff');
    ctx.fillStyle = '#aaffff';
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAP', w / 2, 33);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px Orbitron, monospace';
    const lapDisplay = Math.min(player.lap + 1, this.totalLaps);
    ctx.fillText(`${lapDisplay} / ${this.totalLaps}`, w / 2, 60);

    // Timer (top center-right)
    this._drawPanel(ctx, w / 2 + 140, 12, 200, 56, '#ff00ff');
    ctx.fillStyle = '#ffaaff';
    ctx.font = '700 11px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', w / 2 + 240, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px Orbitron, monospace';
    ctx.fillText(formatTime(elapsed), w / 2 + 240, 56);

    // Best lap (top center-left)
    this._drawPanel(ctx, w / 2 - 340, 12, 200, 56, '#ffaa00');
    ctx.fillStyle = '#ffddaa';
    ctx.font = '700 11px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BEST LAP', w / 2 - 240, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px Orbitron, monospace';
    ctx.fillText(formatTime(bestLap), w / 2 - 240, 56);

    // ---------- Speedometer (bottom left) ----------
    this._drawSpeedometer(ctx, 100, h - 120, player);

    // ---------- Position (bottom right) ----------
    this._drawPosition(ctx, w - 120, h - 120, player, allCars);

    // ---------- Minimap (bottom right) ----------
    this._drawMinimap(ctx, w - 200, h - 190, 170, 150, allCars);

    // ---------- Off-track warning ----------
    if (!player.onTrack) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 200);
      ctx.fillStyle = '#ff4400';
      ctx.font = '700 22px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 20;
      ctx.fillText('⚠ OFF TRACK', w / 2, h / 2 - 60);
      ctx.restore();
    }

    // ---------- Notifications ----------
    this.notifications.forEach((n, i) => {
      const alpha = Math.min(1, n.life / 30);
      const yOff = (this.notifications.length - 1 - i) * 50;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = n.color;
      ctx.font = '700 26px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 20;
      ctx.fillText(n.text, w / 2, h / 2 + yOff);
      ctx.restore();
    });
  }

  _drawPanel(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.75)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawSpeedometer(ctx, cx, cy, car) {
    const radius = 70;
    const speed = formatSpeed(car.speed);
    const maxDisplaySpeed = formatSpeed(car.maxSpeed);
    const ratio = Math.min(1, Math.abs(car.speed) / car.maxSpeed);

    ctx.save();

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Speed arc (colored)
    const startAngle = Math.PI * 0.75;
    const endAngle = startAngle + ratio * Math.PI * 1.5;
    const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    grad.addColorStop(0, '#00ffff');
    grad.addColorStop(0.6, '#00ff88');
    grad.addColorStop(1, '#ff4400');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Speed text
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.fillText(speed, cx, cy + 10);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '500 12px Orbitron, monospace';
    ctx.fillText('km/h', cx, cy + 28);

    // Ring glow
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  _drawPosition(ctx, cx, cy, player, allCars) {
    // Sort by progress
    const sorted = [...allCars].sort((a, b) => {
      const pa = a.lap * 10000 + a.closestIdx;
      const pb = b.lap * 10000 + b.closestIdx;
      return pb - pa;
    });
    const pos = sorted.indexOf(player) + 1;
    const total = allCars.length;

    const suffix = ['', 'ST', 'ND', 'RD', 'TH'][Math.min(pos, 4)] || 'TH';

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.75)';
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(cx - 70, cy - 70, 140, 110, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffddaa';
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.fillText('POSITION', cx, cy - 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${pos <= 9 ? 52 : 42}px Orbitron, monospace`;
    ctx.fillText(pos, cx - 15, cy + 12);

    ctx.fillStyle = '#ffaa00';
    ctx.font = '700 18px Orbitron, monospace';
    ctx.fillText(suffix, cx + 22, cy - 10);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px Orbitron, monospace';
    ctx.fillText(`/ ${total}`, cx, cy + 32);

    ctx.restore();
  }

  _drawMinimap(ctx, x, y, w, h, allCars) {
    const track = allCars[0]?.track;
    if (!track) return;

    // Find bounding box of track
    const pts = track.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const scaleX = w / (maxX - minX + 40);
    const scaleY = h / (maxY - minY + 40);
    const scale = Math.min(scaleX, scaleY) * 0.85;
    const ox = x + w / 2 - ((maxX + minX) / 2) * scale;
    const oy = y + h / 2 - ((maxY + minY) / 2) * scale;

    ctx.save();
    // Panel
    ctx.fillStyle = 'rgba(0,0,20,0.8)';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Draw track outline
    ctx.beginPath();
    pts.forEach((p, i) => {
      const mx = p.x * scale + ox;
      const my = p.y * scale + oy;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,255,255,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(100,100,255,0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Draw cars
    const carColors = ['#00ffff', '#ff006e', '#8338ec', '#fb5607'];
    allCars.forEach((car, i) => {
      const mx = car.x * scale + ox;
      const my = car.y * scale + oy;
      ctx.beginPath();
      ctx.arc(mx, my, car.isPlayer ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = carColors[i] || '#ffffff';
      ctx.shadowColor = carColors[i] || '#ffffff';
      ctx.shadowBlur = car.isPlayer ? 10 : 6;
      ctx.fill();
    });

    ctx.restore();
  }

  drawCountdown(count) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h);

    const text = count > 0 ? String(count) : 'GO!';
    const color = count > 0 ? '#ff4444' : '#00ff88';
    ctx.font = `700 120px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 40;
    ctx.fillText(text, w / 2, h / 2 + 40);
    ctx.restore();
  }
}

export { HUD, formatTime };
