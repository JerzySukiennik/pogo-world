// Player physics: auto-bouncing pogo, charge jumps, wall bounce, ragdoll, respawn.
import * as THREE from 'three';

const G = 28;
const BASE_VY = 8.6;
const MAX_VY = 15.6;
const AIR_ACCEL = 26;
const MAX_SPEED = 9;
const RADIUS = 0.45;
const HEIGHT = 2.3;
const KILL_Y = -24;

export class Player {
  constructor(world, audio, events) {
    this.world = world;
    this.audio = audio;
    this.events = events || {};
    this.pos = world.zones[0].spawn.clone();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.spring = 0;
    this.ragdoll = 0;
    this.ragVel = new THREE.Vector3();
    this.ragSpin = new THREE.Vector3();
    this.zone = world.zones[0];
    this.airTime = 0;
  }

  currentZone() {
    let best = this.world.zones[0], bd = Infinity;
    for (const z of this.world.zones) {
      const d = (this.pos.x - z.center.x) ** 2 + (this.pos.z - z.center.z) ** 2;
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }

  respawn() {
    this.zone = this.currentZone();
    this.pos.copy(this.zone.spawn);
    this.vel.set(0, 2, 0);
    this.ragdoll = 0;
  }

  crash() {
    if (this.ragdoll > 0) return;
    this.ragdoll = 1.8;
    this.ragVel.copy(this.vel).multiplyScalar(0.6);
    this.ragVel.y = Math.max(this.ragVel.y, 4);
    this.ragSpin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9);
    this.audio.clatter();
    if (this.events.onCrash) this.events.onCrash();
  }

  update(dt, input, camYaw) {
    if (this.ragdoll > 0) {
      this.ragdoll -= dt;
      this.ragVel.y -= G * 0.8 * dt;
      this.pos.addScaledVector(this.ragVel, dt);
      if (this.pos.y < 0.4 && this.ragVel.y < 0) { this.ragVel.y *= -0.35; this.ragVel.x *= 0.7; this.ragVel.z *= 0.7; }
      if (this.ragdoll <= 0) this.respawn();
      return;
    }

    this._input = input;
    const move = new THREE.Vector3(input.x, 0, input.z);
    if (move.lengthSq() > 0) {
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
      const targetYaw = Math.atan2(move.x, move.z);
      let dy = targetYaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 10);
    }
    this.vel.x += move.x * AIR_ACCEL * dt;
    this.vel.z += move.z * AIR_ACCEL * dt;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const cap = input.space ? MAX_SPEED * 1.25 : MAX_SPEED;
    if (hs > cap) { this.vel.x *= cap / hs; this.vel.z *= cap / hs; }
    if (move.lengthSq() === 0) {
      const damp = this.airTime < 0.12 ? 3.5 : 0.5;
      this.vel.x *= 1 - Math.min(1, dt * damp);
      this.vel.z *= 1 - Math.min(1, dt * damp);
    }

    this.vel.y -= G * dt;
    this.airTime += dt;

    const prevY = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);
    this.spring = Math.min(1, this.spring + dt * 8);

    for (const c of this.world.colliders) {
      if (c.type === 'box') this.collideBox(c, prevY);
      else this.collideDisc(c, prevY);
    }

    for (const r of this.world.rotors) {
      const a = r.pivot.rotation.y;
      const dirx = Math.cos(a), dirz = -Math.sin(a);
      const relx = this.pos.x - r.pivot.position.x, relz = this.pos.z - r.pivot.position.z;
      const along = relx * dirx + relz * dirz;
      const perp = Math.abs(relx * -dirz + relz * dirx);
      const vertical = this.pos.y < r.y + 0.8 && this.pos.y + HEIGHT > r.y - 0.8;
      if (Math.abs(along) < r.len / 2 && perp < 0.9 && vertical) {
        const push = Math.abs(r.speed) * r.len * 0.5;
        const dir = Math.sign(along) * Math.sign(r.speed);
        this.vel.x += -dirz * push * dir;
        this.vel.z += dirx * push * dir;
        this.vel.y = Math.max(this.vel.y, 5);
        this.audio.bonk();
        this.crash();
      }
    }

    if (this.pos.y < KILL_Y) this.crash();
  }

  bounce(power, boost = 0) {
    this.vel.y = boost || (BASE_VY + (MAX_VY - BASE_VY) * power);
    this.spring = 0;
    this.airTime = 0;
    if (this.events.onBounce) this.events.onBounce(power, boost);
  }

  landOn(top, input) {
    if (this.vel.y > 0) return;
    this.pos.y = top;
    const power = input.space ? 1 : 0;
    this.bounce(power);
    this.audio.boing(0.35 + power * 0.5, Math.min(1, this.airTime / 1.2));
  }

  collideBox(c, prevY) {
    const p = this.pos;
    if (p.x + RADIUS < c.min.x || p.x - RADIUS > c.max.x) return;
    if (p.z + RADIUS < c.min.z || p.z - RADIUS > c.max.z) return;
    if (p.y > c.max.y || p.y + HEIGHT < c.min.y) return;

    if (prevY >= c.max.y - 0.01 && this.vel.y <= 0) {
      if (c.bounce) { this.pos.y = c.max.y; this.bounce(1, c.bounce); this.audio.shroom(); }
      else this.landOn(c.max.y, this._input);
      return;
    }
    if (prevY + HEIGHT <= c.min.y + 0.01 && this.vel.y > 0) {
      this.pos.y = c.min.y - HEIGHT;
      this.vel.y = 0;
      return;
    }
    const dxl = p.x + RADIUS - c.min.x, dxr = c.max.x - (p.x - RADIUS);
    const dzl = p.z + RADIUS - c.min.z, dzr = c.max.z - (p.z - RADIUS);
    const m = Math.min(dxl, dxr, dzl, dzr);
    let nx = 0, nz = 0;
    if (m === dxl) { p.x = c.min.x - RADIUS; nx = -1; }
    else if (m === dxr) { p.x = c.max.x + RADIUS; nx = 1; }
    else if (m === dzl) { p.z = c.min.z - RADIUS; nz = -1; }
    else { p.z = c.max.z + RADIUS; nz = 1; }
    const vn = this.vel.x * nx + this.vel.z * nz;
    if (vn < 0) {
      const speed = Math.abs(vn);
      this.vel.x -= (1 + 0.85) * vn * nx;
      this.vel.z -= (1 + 0.85) * vn * nz;
      if (speed > 3.2) {
        this.vel.y = Math.max(this.vel.y, 6.8);
        this.audio.bonk();
        if (this.events.onWall) this.events.onWall();
      }
    }
  }

  collideDisc(c, prevY) {
    const p = this.pos;
    const dx = p.x - c.cx, dz = p.z - c.cz;
    const d = Math.hypot(dx, dz);
    if (d > c.r + RADIUS) return;
    if (p.y > c.top || p.y + HEIGHT < c.y) return;
    if (prevY >= c.top - 0.15 && this.vel.y <= 0 && d < c.r) {
      if (c.bounce) { this.pos.y = c.top; this.bounce(1, c.bounce); this.audio.shroom(); }
      else this.landOn(c.top, this._input);
      return;
    }
    if (d > 0.001) {
      const push = (c.r + RADIUS - d);
      p.x += (dx / d) * push;
      p.z += (dz / d) * push;
      const vn = this.vel.x * (dx / d) + this.vel.z * (dz / d);
      if (vn < 0) {
        this.vel.x -= 1.85 * vn * (dx / d);
        this.vel.z -= 1.85 * vn * (dz / d);
        if (Math.abs(vn) > 3.2) { this.vel.y = Math.max(this.vel.y, 6.8); this.audio.bonk(); }
      }
    }
  }
}
