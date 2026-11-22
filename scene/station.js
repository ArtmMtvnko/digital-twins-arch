// Машинний зал і агрегати: моделі glTF, рівні деталізації, відсікання
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

export async function loadStation(scene) {
  const [hall, lod0, lod1] = await Promise.all([
    'models/hall.glb', 'models/pump-unit.glb', 'models/pump-unit-lod1.glb',
  ].map((url) => loader.loadAsync(url)));
  scene.add(hall.scene);
  const group = new THREE.Group();
  const box = boxOf(lod0.scene);
  SLOTS.forEach((p, i) => {
    const lod = new THREE.LOD();
    lod.name = `pump-${i + 1}`;
    lod.addLevel(lod0.scene.clone(), 0);           // детальна модель
    lod.addLevel(lod1.scene.clone(), 15, 0.1);     // спрощена; гістерезис 10 %
    lod.addLevel(box.clone(), 60, 0.1);            // паралелепіпед
    lod.addLevel(new THREE.Object3D(), 250);       // далі — не рисувати
    lod.position.set(...p);
    group.add(lod);
  });
  scene.add(group);

  function paint(unit, element, color) {  // колір елемента одного агрегату
    let found = false;
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
  return { group, paint };
}
