// Visual rig: skeleton avatar riding the pogo stick GLB, spring squash, ragdoll tumble, nametags.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
let pogoProto = null;
let skelProto = null;

function fitToHeight(obj, targetH) {
  const box = new THREE.Box3().setFromObject(obj);
  const h = box.max.y - box.min.y;
  const s = targetH / (h || 1);
  obj.scale.setScalar(s);
  box.setFromObject(obj);
  obj.position.y -= box.min.y;
  return obj;
}

export async function loadProtos() {
  const [pogo, skel] = await Promise.all([
    loader.loadAsync('assets/models/pogo.glb'),
    loader.loadAsync('assets/models/skeleton.glb'),
  ]);
  pogoProto = pogo.scene;
  skelProto = skel.scene;
  for (const proto of [pogoProto, skelProto]) {
    proto.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  }
}

export function createRig(scene) {
  const group = new THREE.Group();
  const bob = new THREE.Group();
  group.add(bob);

  const pogoWrap = new THREE.Group();
  const pogo = pogoProto.clone(true);
  fitToHeight(pogo, 1.55);
  pogoWrap.add(pogo);
  bob.add(pogoWrap);

  const skelWrap = new THREE.Group();
  const skel = skelProto.clone(true);
  fitToHeight(skel, 1.75);
  skel.position.y += 0.42;
  skel.position.z += 0.06;
  skelWrap.add(skel);
  bob.add(skelWrap);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  scene.add(group);
  return { group, bob, pogoWrap, skelWrap, shadow, ragRot: new THREE.Euler() };
}

export function updateRig(rig, pos, yaw, vel, spring, ragdoll, ragSpin, dt, groundY = 0) {
  rig.group.position.copy(pos);
  if (ragdoll > 0) {
    rig.ragRot.x += (ragSpin ? ragSpin.x : 6) * dt;
    rig.ragRot.z += (ragSpin ? ragSpin.z : 4) * dt;
    rig.group.rotation.set(rig.ragRot.x, yaw, rig.ragRot.z);
    rig.shadow.visible = false;
    return;
  }
  rig.ragRot.set(0, 0, 0);
  const compress = 1 - Math.max(0, 1 - spring * 2.4) * 0.28;
  rig.bob.scale.y = compress;
  const hs = Math.hypot(vel.x, vel.z);
  const lean = Math.min(0.35, hs * 0.035);
  rig.group.rotation.set(lean, yaw, 0, 'YXZ');
  rig.shadow.visible = true;
  rig.shadow.position.set(pos.x, groundY + 0.03, pos.z);
  const spread = Math.min(1.4, Math.max(0.4, 1 - (pos.y - groundY) * 0.04));
  rig.shadow.scale.setScalar(spread);
}

export function makeNametag(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,.65)';
  g.strokeText(name, 128, 42);
  g.fillStyle = '#ffffff';
  g.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.75;
  return sprite;
}
