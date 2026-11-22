// Машинний зал і агрегати: моделі glTF, рівні деталізації, відсікання
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const loader = new GLTFLoader();
export const SLOTS = [[-2.8, 0, 0], [2.8, 0, 0]];   // Н1 і Н2 у залі 12 × 8 м

const elementOf = (o) => {         // найближчий предок з extras.element
  while (o && o.userData.element === undefined) o = o.parent;
  return o?.userData.element;
};

function boxOf(model) {            // LOD2: обмежувальний паралелепіпед моделі
  const b = new THREE.Box3().setFromObject(model);
  const geo = new THREE.BoxGeometry(...b.getSize(new THREE.Vector3()));
  geo.translate(...b.getCenter(new THREE.Vector3()));
  return new THREE.Mesh(geo,
    new THREE.MeshStandardMaterial({ color: 0x8a8f96 }));
}

function instanced(model) {        // одна InstancedMesh на кожну деталь
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mesh = new THREE.InstancedMesh(o.geometry, o.material.clone(),
      SLOTS.length);
    mesh.name = elementOf(o) ?? '';
    const base = o.material.color.clone();
    mesh.material.color.set(0xffffff);     // колір задає екземпляр
    SLOTS.forEach((p, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(...p).multiply(o.matrixWorld));
      mesh.setColorAt(i, base);
    });
    group.add(mesh);
  });
  return group;
}

function setLevel0(lod, object) {          // заміна детального рівня LOD
  lod.remove(lod.levels[0].object);
  lod.levels[0].object = object;
  lod.add(object);
}

// Оптимізації заняття 2 вмикає параметр адреси ?opt=…: inst — інстансування,
// ktx2 — стиснені текстури, simp — спрощена детальна модель,
// defer — відкладене завантаження детальної моделі й тайлів
export async function loadStation(scene, opt, renderer) {
  if (opt.has('ktx2')) {                   // декодер KTX2 → формат, що є на ГП
    const ktx2 = new KTX2Loader().setTranscoderPath(
      'node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  const detail = opt.has('simp') ? 'models/pump-unit-s.glb'
    : 'models/pump-unit.glb';
  const files = [opt.has('ktx2') ? 'models/hall-ktx2.glb' : 'models/hall.glb',
    'models/pump-unit-lod1.glb'];
  if (!opt.has('defer')) files.push(detail);
  const [hall, lod1, lod0 = lod1] = await Promise.all(
    files.map((url) => loader.loadAsync(url)));
  scene.add(hall.scene);
  const box = boxOf(lod1.scene);
  const group = new THREE.Group();
  const levels = (make) => [[make(lod0.scene), 0], [make(lod1.scene), 15],
    [make(box), 60], [new THREE.Object3D(), 250]];

  if (opt.has('inst')) {                   // один LOD на всю групу агрегатів
    const lod = new THREE.LOD();
    levels(instanced).forEach(([o, d], k) => lod.addLevel(o, d * 2, k && 0.1));
    group.add(lod);
  } else {                                 // LOD для кожного агрегату
    SLOTS.forEach((p, i) => {
      const lod = new THREE.LOD();
      lod.name = `pump-${i + 1}`;
      levels((o) => o.clone()).forEach(([o, d], k) =>
        lod.addLevel(o, d, k && 0.1));
      lod.position.set(...p);
      group.add(lod);
    });
  }
  scene.add(group);

  function paint(unit, element, color) {  // колір елемента одного агрегату
    let found = false;
    if (opt.has('inst')) {
      const i = Number(unit.split('-')[1]) - 1;      // pump-1 → екземпляр 0
      group.traverse((o) => {
        if (!o.isInstancedMesh || o.name !== element) return;
        o.setColorAt(i, color);
        o.instanceColor.needsUpdate = found = true;
      });
      return found;
    }
    group.getObjectByName(unit)?.traverse((o) => {
      if (!o.isMesh || elementOf(o) !== element) return;
      if (!o.userData.own) {               // власна копія матеріалу:
        o.material = o.material.clone();   // спільний змінив би обидва агрегати
        o.userData.own = true;
      }
      o.material.color.copy(color);
      found = true;
    });
    return found;
  }

  async function afterFirstFrame() {       // defer: детальна модель — пізніше
    if (!opt.has('defer')) return;
    const model = (await loader.loadAsync(detail)).scene;
    for (const lod of group.children)
      setLevel0(lod, opt.has('inst') ? instanced(model) : model.clone());
  }
  return { group, paint, afterFirstFrame };
}
