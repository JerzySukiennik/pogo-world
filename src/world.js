// World builder: three biomes (purple arena, acid hills, shroom forest), colliders, rotors.
import * as THREE from 'three';

function checkerTexture(colA, colB, cells = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const s = 128 / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    g.fillStyle = (x + y) % 2 ? colA : colB;
    g.fillRect(x * s, y * s, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene) {
  const colliders = [];
  const rotors = [];

  const texPurple = checkerTexture('#a53df0', '#9b2ee8');
  const texPurpleDark = checkerTexture('#8226d8', '#7a1fd0');
  const texOrange = checkerTexture('#f5a623', '#eda01d');
  const texGreen = checkerTexture('#1fb877', '#18ad6e');
  const texTeal = checkerTexture('#3fe0a8', '#36d69e');
  const texRed = checkerTexture('#e8354f', '#de2c46');
  const texYellow = checkerTexture('#f7b733', '#f0af2b');

  const matGround = new THREE.MeshLambertMaterial({ color: 0x36363c });

  function box(x, y, z, w, h, d, tex, opts = {}) {
    const m = new THREE.MeshLambertMaterial(tex.isTexture ? { map: tex } : { color: tex });
    if (tex.isTexture) {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(d / 4)));
      m.map = t;
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ type: 'box', min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 }, bounce: opts.bounce || 0 });
    return mesh;
  }

  function disc(x, y, z, r, h, color, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * (opts.taper || 1), h, 10, 1), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ type: 'disc', cx: x, cz: z, r, y, top: y + h, bounce: opts.bounce || 0 });
    return mesh;
  }

  function deco(mesh) { mesh.castShadow = true; scene.add(mesh); return mesh; }

  // ---- Zone 1: purple arena on dark void ground ----
  const ground = new THREE.Mesh(new THREE.BoxGeometry(360, 2, 360), matGround);
  ground.position.set(0, -1, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  colliders.push({ type: 'box', min: { x: -180, y: -2, z: -180 }, max: { x: 180, y: 0, z: 180 }, bounce: 0 });

  box(0, 0, 0, 18, 1.2, 18, texPurple);
  box(0, 0, -16, 6, 1.2, 10, texPurple);
  box(0, 1.2, -28, 8, 1.4, 8, texPurple);
  box(7, 2.6, -36, 6, 1.4, 6, texPurpleDark);
  box(14, 4, -44, 6, 1.6, 6, texPurple);
  box(14, 5.6, -56, 10, 2, 10, texPurpleDark);
  box(26, 0, -56, 4, 12, 12, texPurple);
  box(2, 0, -56, 4, 14, 12, texPurple);
  box(14, 10, -74, 8, 1.6, 8, texPurple);
  box(14, 0, -92, 14, 3, 14, texPurpleDark);
  box(-14, 0, -20, 5, 5, 5, texPurple);
  box(-24, 0, -30, 5, 8, 5, texPurpleDark);
  box(-34, 0, -42, 8, 11, 8, texPurple);
  box(20, 0, 8, 10, 2.2, 10, texPurpleDark);
  box(34, 0, 16, 8, 4, 8, texPurple);

  // orange & green obstacle yard
  box(-6, 0, 34, 12, 2, 12, texOrange);
  box(-6, 2, 50, 8, 2.4, 8, texOrange);
  box(6, 4, 60, 8, 2.4, 8, texGreen);
  box(-6, 6, 70, 10, 2.6, 10, texOrange);
  box(-6, 8.6, 70, 3, 9, 3, texGreen);
  box(-24, 0, 60, 6, 7, 6, texGreen);
  box(-36, 0, 70, 8, 10, 8, texOrange);

  function rotor(x, y, z, len, speed) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 1), new THREE.MeshLambertMaterial({ map: texRed }));
    arm.castShadow = true;
    pivot.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pivot.add(hub);
    scene.add(pivot);
    rotors.push({ pivot, len, speed, y });
  }
  rotor(-6, 8.1, 70, 12, 1.6);
  rotor(14, 6.8, -56, 12, -1.3);

  // ---- Zone 2: acid hills (x +170) ----
  const ax = 170;
  disc(ax, -0.5, 0, 75, 1.7, 0xf7b733);
  disc(ax - 30, 0, -30, 16, 9, 0x8e2ee0, { taper: 1.1 });
  disc(ax + 34, 0, -42, 20, 16, 0x9b3df0, { taper: 1.05 });
  disc(ax + 10, 0, 40, 12, 6, 0x8e2ee0);
  const stairs = 12;
  for (let i = 0; i < stairs; i++) box(ax - 30, 1.2 + i * 0.65, -6 - i * 2.0, 4, 0.7, 2.2, texRed);
  box(ax - 30, 9, -32, 8, 0.01 + 0, 8, texPurpleDark);
  for (const [tx, tz, s] of [[ax - 8, 24, 1], [ax - 2, 28, 1.3], [ax + 6, 22, 0.9], [ax - 16, 30, 1.1]]) {
    const trunk = deco(new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.6 * s, 3 * s, 8), new THREE.MeshLambertMaterial({ color: 0xcccccc })));
    trunk.position.set(tx, 1.5 * s + 0.7, tz);
    const crown = deco(new THREE.Mesh(new THREE.SphereGeometry(2.1 * s, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2fd98a })));
    crown.position.set(tx, 4.3 * s + 0.7, tz);
  }
  function shroom(x, y, z, r, stemH, capColor, bounce = 14) {
    const stem = deco(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.36, stemH, 10), new THREE.MeshLambertMaterial({ color: 0xd8d4cc })));
    stem.position.set(x, y + stemH / 2, z);
    const cap = deco(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshLambertMaterial({ color: capColor })));
    cap.scale.y = 0.45;
    cap.position.set(x, y + stemH, z);
    colliders.push({ type: 'disc', cx: x, cz: z, r: r * 0.92, y: y + stemH - r * 0.2, top: y + stemH + r * 0.12, bounce });
    return cap;
  }
  shroom(ax + 4, 0.7, -8, 4, 2.4, 0xe8354f);
  shroom(ax + 20, 0.7, 10, 3, 1.8, 0xe8354f);
  shroom(ax - 12, 0.7, 8, 2.4, 1.6, 0xe8354f);
  shroom(ax + 34, 16, -42, 5, 1.5, 0xe8354f, 17);

  // ---- Zone 3: shroom forest (x -170) ----
  const sx = -170;
  disc(sx, -0.5, 0, 75, 1.7, 0x3fe0a8);
  const capCols = [0x5b2bd6, 0x7a3cf0, 0x3fe0a8, 0x9b4dff];
  const forest = [
    [sx + 10, 6, 8, 6], [sx - 8, 4, 9, 20], [sx + 2, 9, 12, -14], [sx - 20, 7, 16, -2],
    [sx - 34, 10, 22, 10], [sx + 24, 8, 18, -26], [sx + 40, 6, 26, -8], [sx - 48, 5, 28, -20],
    [sx + 14, 11, 30, 22], [sx - 12, 13, 34, 30],
  ];
  let ci = 0;
  for (const [fx, r, h, fz] of forest) {
    shroom(fx, 1.2, fz, r * 0.8, h, capCols[ci++ % capCols.length], 15);
  }
  for (const [tx, tz] of [[sx + 30, 24], [sx - 30, -30], [sx + 44, 8], [sx - 52, 4]]) {
    const cone = deco(new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 8), new THREE.MeshLambertMaterial({ color: 0x9b4dff })));
    cone.position.set(tx, 4.7, tz);
    const st = deco(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.6, 8), new THREE.MeshLambertMaterial({ color: 0xbbb7ae })));
    st.position.set(tx, 1.3 + 0.7, tz);
  }
  const grassGeo = new THREE.ConeGeometry(0.16, 0.9, 4);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x2bc490 });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 300);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, rr = 12 + Math.random() * 58;
    dummy.position.set(sx + Math.cos(a) * rr, 1.6, Math.sin(a) * rr);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);

  const zones = [
    { name: 'arena', center: new THREE.Vector3(0, 0, 0), spawn: new THREE.Vector3(0, 1.4, 4), sky: new THREE.Color(0x9aa3ad), fog: new THREE.Color(0x9aa3ad) },
    { name: 'acid', center: new THREE.Vector3(ax, 0, 0), spawn: new THREE.Vector3(ax, 1.4, 14), sky: new THREE.Color(0xffb6c9), fog: new THREE.Color(0xffc4d4) },
    { name: 'shroom', center: new THREE.Vector3(sx, 0, 0), spawn: new THREE.Vector3(sx, 1.4, -6), sky: new THREE.Color(0xf6f08a), fog: new THREE.Color(0xf3eda0) },
  ];

  return { colliders, rotors, zones };
}

export function updateRotors(rotors, dt) {
  for (const r of rotors) r.pivot.rotation.y += r.speed * dt;
}
