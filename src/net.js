// Multiplayer: Firebase RTDB presence under /pogoworld, 15Hz snapshots, interpolated remotes.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBr3agIuH4XL71P7QBc9P5bsoVlonIgFns',
  authDomain: 'untitled-pogo-game.firebaseapp.com',
  databaseURL: 'https://untitled-pogo-game-default-rtdb.firebaseio.com',
  projectId: 'untitled-pogo-game',
  storageBucket: 'untitled-pogo-game.firebasestorage.app',
  messagingSenderId: '682885244016',
  appId: '1:682885244016:web:ed904a2f23281a367b80b5',
};

const PUBLISH_HZ = 15;
const STALE_MS = 10000;

export class Net {
  constructor() {
    this.remotes = new Map();
    this.ready = false;
    this._lastPub = 0;
    this._cbs = { join: [], leave: [] };
  }

  on(ev, fn) { this._cbs[ev].push(fn); }

  async connect(name) {
    const app = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
    const db = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js');
    this._db = db;
    const fbApp = app.initializeApp(FIREBASE_CONFIG);
    this.database = db.getDatabase(fbApp);
    this.pid = sessionStorage.getItem('pw_pid') || 'p' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('pw_pid', this.pid);
    this.name = name;
    this.meRef = db.ref(this.database, `pogoworld/players/${this.pid}`);
    db.onDisconnect(this.meRef).remove();

    const playersRef = db.ref(this.database, 'pogoworld/players');
    db.onValue(playersRef, (snap) => {
      const val = snap.val() || {};
      const now = Date.now();
      const seen = new Set();
      for (const [pid, p] of Object.entries(val)) {
        if (pid === this.pid || !p || typeof p.x !== 'number') continue;
        if (p.ls && now - p.ls > STALE_MS) continue;
        seen.add(pid);
        let r = this.remotes.get(pid);
        if (!r) {
          r = { pid, name: p.n || '???', cur: { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0 }, tgt: {}, spring: 1, rag: 0 };
          this.remotes.set(pid, r);
          for (const fn of this._cbs.join) fn(r);
        }
        r.tgt = { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0 };
        r.spring = p.sp ?? 1;
        r.rag = p.rg || 0;
      }
      for (const [pid, r] of this.remotes) {
        if (!seen.has(pid)) {
          this.remotes.delete(pid);
          for (const fn of this._cbs.leave) fn(r);
        }
      }
    });
    this.ready = true;
  }

  publish(player) {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this._lastPub < 1000 / PUBLISH_HZ) return;
    this._lastPub = now;
    this._db.set(this.meRef, {
      n: this.name,
      x: +player.pos.x.toFixed(2),
      y: +player.pos.y.toFixed(2),
      z: +player.pos.z.toFixed(2),
      yaw: +player.yaw.toFixed(2),
      sp: +player.spring.toFixed(2),
      rg: player.ragdoll > 0 ? 1 : 0,
      ls: Date.now(),
    }).catch(() => {});
  }

  tick(dt) {
    for (const r of this.remotes.values()) {
      const k = Math.min(1, dt * 10);
      r.cur.x += (r.tgt.x - r.cur.x) * k;
      r.cur.y += (r.tgt.y - r.cur.y) * k;
      r.cur.z += (r.tgt.z - r.cur.z) * k;
      let dy = (r.tgt.yaw - r.cur.yaw);
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.cur.yaw += dy * k;
    }
  }

  disconnect() {
    if (this.meRef && this._db) this._db.remove(this.meRef).catch(() => {});
  }
}
