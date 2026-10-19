// Jumping for the Warframe (wiki: https://wiki.warframe.com/w/Maneuvers).
//   - Jump (A): a short hop in the direction you move, or where you aim when standing still.
//   - Double jump: a second jump while in the air. Landing restores it.
//   - Bullet jump: crouch, then jump. It launches toward your aim at 14.5 m/s (wiki) and slows over the flight.
//     Wiki: a blast of 100 Blast damage within 3 m, where the jump begins, with a guaranteed Blast proc.
//     It can't be repeated until you touch the ground, and a double jump can't follow it.
// Placeholders: the hop and double jump distances (the wiki gives no numbers for them), the bullet jump distance
// (14 m, forum reference), the falloff floor of the blast, and the crouch sizes.

export const JUMP = {
  hopSeconds: 0.3,          // how long a hop lasts
  hopSpeed: 600,            // units/s (600 units/s for 0.3 s is 12 m)
  doubleSpeed: 480,         // the double jump is a little shorter (placeholder)
  bulletSpeed: 217.5,       // units/s: 14.5 m/s initial speed (wiki)
  bulletDistance: 210,      // units: 14 m (forum reference). Linear slowdown from bulletSpeed, so the flight lasts 2 * distance / speed
  blastRadius: 45,          // units: 3 m
  blastDamage: 100,         // Blast damage, from the wiki
  blastMinFraction: 0.25,   // damage at the blast's edge as a fraction of the centre (placeholder, the same as grenades)
  standRadius: 16,          // units
  crouchRadius: 11,         // a smaller hitbox while crouched (placeholder)
  crouchSightFactor: 0.5,   // enemies see a crouched Warframe from half the distance (placeholder)
  crouchSquash: 0.7,        // the figure is drawn at 70% height while crouched: a squat puts the head at roughly 2/3 to 3/4 of standing height
};

export class JumpState {
  constructor() {
    this.timeLeft = 0;      // seconds of jump left
    this.vx = 0;
    this.vy = 0;
    this.jumpsLeft = 1;     // a double jump is available once per landing
    this.bulletReady = true; // a bullet jump needs the ground first
    this.bulletActive = false;
    this.bulletDir = { x: 0, y: 0 };
    this.bulletSeconds = 1;
  }

  get airborne() {
    return this.timeLeft > 0;
  }

  // Starts a jump. move is the movement direction (may be zero); aim is the aim direction.
  // Returns 'hop', 'double', 'bullet', or null when nothing happens.
  press(moveX, moveY, aimX, aimY, crouching) {
    const moving = moveX !== 0 || moveY !== 0;
    const ux = moving ? moveX : aimX;
    const uy = moving ? moveY : aimY;
    const len = Math.hypot(ux, uy) || 1;
    const nx = ux / len;
    const ny = uy / len;

    if (this.airborne) {
      if (this.jumpsLeft > 0 && !this.bulletActive) {
        this.start(nx * JUMP.doubleSpeed, ny * JUMP.doubleSpeed, JUMP.hopSeconds);
        this.jumpsLeft = 0;
        return 'double';
      }
      return null;
    }

    if (crouching && this.bulletReady) {
      // Bullet jump: toward the aim at bulletSpeed, slowing linearly so it covers bulletDistance
      const aimLen = Math.hypot(aimX, aimY) || 1;
      this.bulletDir = { x: aimX / aimLen, y: aimY / aimLen };
      this.bulletSeconds = (2 * JUMP.bulletDistance) / JUMP.bulletSpeed;
      this.start(this.bulletDir.x * JUMP.bulletSpeed, this.bulletDir.y * JUMP.bulletSpeed, this.bulletSeconds);
      this.bulletActive = true;
      this.bulletReady = false;
      this.jumpsLeft = 0;
      return 'bullet';
    }

    this.start(nx * JUMP.hopSpeed, ny * JUMP.hopSpeed, JUMP.hopSeconds);
    this.jumpsLeft = 1;
    this.bulletActive = false;
    return 'hop';
  }

  start(vx, vy, seconds) {
    this.vx = vx;
    this.vy = vy;
    this.timeLeft = seconds;
  }

  // Advances the jump by dt. Returns { landed: 'hop' | 'bullet' } on the frame the jump ends, otherwise null.
  update(dt) {
    if (!this.airborne) return null;
    this.timeLeft -= dt;
    if (this.timeLeft > 0) {
      if (this.bulletActive) {
        // The bullet jump slows linearly from bulletSpeed to 0
        const f = this.timeLeft / this.bulletSeconds;
        this.vx = this.bulletDir.x * JUMP.bulletSpeed * f;
        this.vy = this.bulletDir.y * JUMP.bulletSpeed * f;
      }
      return null;
    }
    this.timeLeft = 0;
    this.vx = 0;
    this.vy = 0;
    const landed = this.bulletActive ? 'bullet' : 'hop';
    this.bulletActive = false;
    this.bulletReady = true;  // touching the ground restores the bullet jump and the double jump
    this.jumpsLeft = 1;
    return { landed };
  }
}
