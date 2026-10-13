// ai.js - AI car controller

class AIController {
  constructor(car, track) {
    this.car = car;
    this.track = track;
    this.lookaheadDist = 8 + Math.floor(Math.random() * 6); // how far ahead to look
    this.aggression = 0.7 + Math.random() * 0.3;
    this.reactionNoise = (Math.random() - 0.5) * 0.15;
    this.offTrackRecovery = false;
  }

  update() {
    const car = this.car;
    const track = this.track;
    const pts = track.points;
    const n = pts.length;

    // Look ahead on track
    const aheadIdx = (car.closestIdx + this.lookaheadDist) % n;
    const targetPt = pts[aheadIdx];

    // Direction to target
    const dx = targetPt.x - car.x;
    const dy = targetPt.y - car.y;
    const targetAngle = Math.atan2(dy, dx);

    // Angle difference
    let angleDiff = targetAngle - car.angle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steering
    const steerStrength = Math.min(1, Math.abs(angleDiff) * 2);
    car.steering = Math.sign(angleDiff) * steerStrength + this.reactionNoise;
    car.steering = Math.max(-1, Math.min(1, car.steering));

    // Throttle - slow down on sharp turns
    const sharpness = Math.abs(angleDiff);
    if (!car.onTrack) {
      // Recover
      car.throttle = 0.5;
      this.offTrackRecovery = true;
    } else {
      this.offTrackRecovery = false;
      if (sharpness > 0.6) {
        car.throttle = this.aggression * 0.4;
      } else if (sharpness > 0.3) {
        car.throttle = this.aggression * 0.7;
      } else {
        car.throttle = this.aggression;
      }
    }
  }
}

export { AIController };
