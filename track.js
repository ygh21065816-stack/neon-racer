// track.js - Track definition and rendering

const TRACK_WIDTH = 90;

// Control points for the track (Catmull-Rom spline)
const TRACK_CONTROL_POINTS = [
  { x: 800, y: 200 },
  { x: 1100, y: 150 },
  { x: 1350, y: 200 },
  { x: 1450, y: 350 },
  { x: 1400, y: 520 },
  { x: 1200, y: 620 },
  { x: 1000, y: 580 },
  { x: 850,  y: 650 },
  { x: 700,  y: 750 },
  { x: 500,  y: 780 },
  { x: 300,  y: 720 },
  { x: 180,  y: 580 },
  { x: 150,  y: 430 },
  { x: 200,  y: 300 },
  { x: 350,  y: 220 },
  { x: 550,  y: 180 },
  { x: 700,  y: 200 },
];

// Catmull-Rom spline interpolation
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function generateTrackPoints(controlPoints, samplesPerSegment = 20) {
  const points = [];
  const n = controlPoints.length;
  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      points.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return points;
}

function generateCheckpoints(trackPoints, count = 20) {
  const checkpoints = [];
  const step = Math.floor(trackPoints.length / count);
  for (let i = 0; i < count; i++) {
    const idx = (i * step) % trackPoints.length;
    const nextIdx = (idx + 1) % trackPoints.length;
    const p = trackPoints[idx];
    const n = trackPoints[nextIdx];
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    checkpoints.push({
      x: p.x,
      y: p.y,
      nx, ny,
      // left and right boundary points
      lx: p.x + nx * TRACK_WIDTH,
      ly: p.y + ny * TRACK_WIDTH,
      rx: p.x - nx * TRACK_WIDTH,
      ry: p.y - ny * TRACK_WIDTH,
      index: idx
    });
  }
  return checkpoints;
}

class Track {
  constructor() {
    this.controlPoints = TRACK_CONTROL_POINTS;
    this.points = generateTrackPoints(this.controlPoints, 30);
    this.checkpoints = generateCheckpoints(this.points, 24);
    this.totalPoints = this.points.length;
    this.width = TRACK_WIDTH;

    // Pre-compute normals for track edge rendering
    this.normals = this._computeNormals();

    // Build offscreen canvas for track
    this._trackCanvas = null;
    this._trackCtx = null;
  }

  _computeNormals() {
    const normals = [];
    const pts = this.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const next = pts[(i + 1) % n];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      normals.push({ x: -dy / len, y: dx / len });
    }
    return normals;
  }

  // Get closest point on track to a world position
  getClosestPointIndex(wx, wy) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const dx = wx - p.x;
      const dy = wy - p.y;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }
    return minIdx;
  }

  // Returns signed distance from track center (negative = off track)
  getDistanceFromCenter(wx, wy, idx) {
    if (idx === undefined) idx = this.getClosestPointIndex(wx, wy);
    const p = this.points[idx];
    const n = this.normals[idx];
    const dx = wx - p.x;
    const dy = wy - p.y;
    return Math.abs(dx * n.x + dy * n.y);
  }

  isOnTrack(wx, wy) {
    const idx = this.getClosestPointIndex(wx, wy);
    const d = this.getDistanceFromCenter(wx, wy, idx);
    return d < this.width;
  }

  preRender(worldW, worldH) {
    // Build an offscreen canvas for the track surface
    this._trackCanvas = document.createElement('canvas');
    this._trackCanvas.width = worldW;
    this._trackCanvas.height = worldH;
    this._trackCtx = this._trackCanvas.getContext('2d');
    this._renderTrack(this._trackCtx, worldW, worldH);
  }

  _renderTrack(ctx, worldW, worldH) {
    const pts = this.points;
    const norms = this.normals;
    const w = this.width;

    // Background (grass)
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, worldW, worldH);

    // Draw subtle grid on background
    ctx.strokeStyle = 'rgba(0,80,0,0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < worldW; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldH); ctx.stroke();
    }
    for (let y = 0; y < worldH; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldW, y); ctx.stroke();
    }

    // Track surface
    ctx.save();
    ctx.beginPath();
    // Outer boundary
    for (let i = 0; i <= pts.length; i++) {
      const idx = i % pts.length;
      const p = pts[idx];
      const n = norms[idx];
      const ox = p.x + n.x * (w + 8);
      const oy = p.y + n.y * (w + 8);
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    // Inner boundary (wind backwards)
    ctx.moveTo(pts[0].x - norms[0].x * (w + 8), pts[0].y - norms[0].y * (w + 8));
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const n = norms[i];
      ctx.lineTo(p.x - n.x * (w + 8), p.y - n.y * (w + 8));
    }
    ctx.closePath();
    ctx.fillStyle = '#1a1a2e';
    ctx.fill('evenodd');

    // Track surface texture (subtle)
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const idx = i % pts.length;
      const p = pts[idx];
      const n = norms[idx];
      if (i === 0) ctx.moveTo(p.x + n.x * w, p.y + n.y * w);
      else ctx.lineTo(p.x + n.x * w, p.y + n.y * w);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const n = norms[i];
      ctx.lineTo(p.x - n.x * w, p.y - n.y * w);
    }
    ctx.closePath();

    // Gradient fill for track
    const grad = ctx.createLinearGradient(200, 200, 1400, 700);
    grad.addColorStop(0, '#16213e');
    grad.addColorStop(0.5, '#0f3460');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fill();

    // Center dashed line
    ctx.setLineDash([20, 20]);
    ctx.strokeStyle = 'rgba(255,220,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge glow lines
    // Outer edge
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const idx = i % pts.length;
      const p = pts[idx];
      const n = norms[idx];
      if (i === 0) ctx.moveTo(p.x + n.x * w, p.y + n.y * w);
      else ctx.lineTo(p.x + n.x * w, p.y + n.y * w);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Inner edge
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const idx = i % pts.length;
      const p = pts[idx];
      const n = norms[idx];
      if (i === 0) ctx.moveTo(p.x - n.x * w, p.y - n.y * w);
      else ctx.lineTo(p.x - n.x * w, p.y - n.y * w);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Start/Finish line
    this._drawStartFinish(ctx);
  }

  _drawStartFinish(ctx) {
    const pts = this.points;
    const norms = this.normals;
    const startIdx = 0;
    const p = pts[startIdx];
    const n = norms[startIdx];
    const w = this.width;

    ctx.save();
    // Checkered pattern
    const sx = p.x + n.x * w;
    const sy = p.y + n.y * w;
    const ex = p.x - n.x * w;
    const ey = p.y - n.y * w;

    const next = pts[1];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const tx = dx / len;
    const ty = dy / len;

    const checkSize = 10;
    const numChecks = Math.floor(w * 2 / checkSize);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < numChecks; col++) {
        const t = col / numChecks;
        const bx = sx + (ex - sx) * t;
        const by = sy + (ey - sy) * t;
        const ox = bx + tx * row * checkSize;
        const oy = by + ty * row * checkSize;
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(ox - checkSize / 2, oy - checkSize / 2, checkSize, checkSize);
      }
    }

    // Glow overlay
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  draw(ctx, offsetX, offsetY, scale) {
    ctx.save();
    ctx.translate(-offsetX * scale, -offsetY * scale);
    ctx.scale(scale, scale);
    if (this._trackCanvas) {
      ctx.drawImage(this._trackCanvas, 0, 0);
    }
    ctx.restore();
  }
}

export { Track, TRACK_WIDTH };
