// Модель НСПТ: насосний агрегат і машинний зал станції з примітивів three.js.
// Запуск з каталогу scene: node tools/make-model.mjs
// Вихід: models/pump-unit.glb — агрегат; models/hall.glb — зал з текстурами.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const R = 192;                     // сегментів по колу: надлишкова деталь

async function glb(name, build) {  // будує файл models/<name>.glb
  const doc = new Document();
  const buffer = doc.createBuffer();
  const root = doc.createNode(name);
  doc.createScene(name).addChild(root);
  const acc = (array, type) =>
    doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const mat = (n, rgb, metal = 0.5, rough = 0.5) => doc.createMaterial(n)
    .setBaseColorFactor([...rgb, 1])
    .setMetallicFactor(metal).setRoughnessFactor(rough);
  const tex = (n, bytes) =>
    doc.createTexture(n).setImage(bytes).setMimeType('image/png');
  function part(n, geo, material) {  // ім’я вузла — ідентифікатор елемента
    const a = geo.attributes;
    const prim = doc.createPrimitive().setMaterial(material)
      .setAttribute('POSITION', acc(a.position.array, 'VEC3'))
      .setAttribute('NORMAL', acc(a.normal.array, 'VEC3'))
      .setAttribute('TEXCOORD_0', acc(a.uv.array, 'VEC2'))
      .setIndices(acc(new Uint32Array(geo.index.array), 'SCALAR'));
    const mesh = doc.createMesh(n).addPrimitive(prim);
    root.addChild(doc.createNode(n).setMesh(mesh).setExtras({ element: n }));
  }
  build({ mat, tex, part });
  writeFileSync(`models/${name}.glb`, await new NodeIO().writeBinary(doc));
}

const at = (g, x, y, z) => g.translate(x, y, z);
const alongX = (g) => g.rotateZ(Math.PI / 2);        // вісь циліндра — X
const cyl = (r, h, hs) => new THREE.CylinderGeometry(r, r, h, R, hs);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function motor() {                 // корпус двигуна з 24 ребрами охолодження
  const parts = [alongX(cyl(0.24, 0.75, 24))];
  for (let k = 0; k < 24; k++)
    parts.push(box(0.7, 0.05, 0.02).translate(0, 0.26, 0)
      .rotateX((2 * Math.PI * k) / 24));
  return at(mergeGeometries(parts), -0.5, 0.42, 0);
}

function png(size, pixel) {        // мінімальний кодер PNG: RGB, 8 біт
  const row = 3 * size + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * row + 1 + 3 * x);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))]);
}

const hash = (x, y) => {           // псевдовипадкове 0…1, відтворюване
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const shade = (v, rgb) => rgb.map((c) => Math.max(0, Math.min(255, c + v)));

const floor = (x, y) => shade(14 * hash(x >> 5, y >> 5) + 4 * hash(x, y)
  - (x % 128 < 3 || y % 128 < 3 ? 40 : 0), [128, 128, 122]);
const brick = (x, y) => {
  const r = y >> 6;
  const u = x + (r % 2) * 64;
  if (y % 64 < 4 || u % 128 < 4) return [190, 186, 178];    // шов
  return shade(30 * hash(u >> 7, r) + 4 * hash(x, y), [150, 70, 50]);
};

// Розміри залу НСПТ з двома агрегатами, м
const HALL_W = 12, HALL_D = 8, HALL_H = 3.5;

mkdirSync('models', { recursive: true });
await glb('pump-unit', ({ mat, part }) => {
  const steel = mat('steel', [0.45, 0.5, 0.55], 0.7, 0.4);
  const blue = mat('motor', [0.15, 0.3, 0.6]);
  const red = mat('pump', [0.65, 0.15, 0.12]);
  part('frame', at(box(2.1, 0.12, 0.7), 0, 0.06, 0), steel);
  part('motor', motor(), blue);
  part('fan', at(alongX(cyl(0.22, 0.15, 6)), -0.95, 0.42, 0), blue);
  part('coupling', at(alongX(cyl(0.09, 0.16, 6)), 0, 0.42, 0), steel);
  part('bearing', at(alongX(cyl(0.11, 0.3, 12)), 0.23, 0.42, 0), steel);
  part('pump', at(alongX(cyl(0.32, 0.26, 24)), 0.55, 0.45, 0), red);
  part('inlet', at(alongX(cyl(0.11, 0.45, 12)), 0.9, 0.45, 0), steel);
  part('outlet', at(cyl(0.09, 0.6, 12), 0.55, 0.98, 0), steel);
  part('sensor-p', at(cyl(0.035, 0.14, 4), 0.55, 1.35, 0), steel);
  part('sensor-v', at(box(0.06, 0.06, 0.06), 0.23, 0.56, 0), steel);
});
await glb('hall', ({ mat, tex, part }) => {
  const f = mat('floor', [1, 1, 1], 0, 0.9)
    .setBaseColorTexture(tex('floor', png(2048, floor)));
  const w = mat('wall', [1, 1, 1], 0, 0.9)
    .setBaseColorTexture(tex('wall', png(2048, brick)));
  const W = HALL_W, D = HALL_D, H = HALL_H, t = 0.3;
  part('floor', at(box(W, 0.2, D), 0, -0.1, 0), f);
  part('wall-n', at(box(W, H, t), 0, H / 2, -(D + t) / 2), w);
  part('wall-s', at(box(W, H, t), 0, H / 2, (D + t) / 2), w);
  part('wall-w', at(box(t, H, D + 2 * t), -(W + t) / 2, H / 2, 0), w);
  part('wall-e', at(box(t, H, D + 2 * t), (W + t) / 2, H / 2, 0), w);
});
console.log('Готово: models/pump-unit.glb, models/hall.glb');