// Прив’язка стану двійника до елементів сцени за таблицею binding.json
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export async function bindTwin(station) {
  const cfg = await (await fetch('binding.json')).json();
  const color = new THREE.Color();
  let sourceTs = 0;                         // час відліку на джерелі, мс
  $('thing').textContent = cfg.thing;
  for (const b of cfg.bindings)
    $('vals').insertAdjacentHTML('beforeend', `<tr><td>${b.title}</td>` +
      `<td id="${b.asset}-${b.node}">—</td><td>${b.unit}</td></tr>`);

  function apply(thing) {                   // новий стан двійника → сцена
    const f = thing.features ?? {};
    let bound = 0;
    for (const b of cfg.bindings) {
      const v = f[b.feature]?.properties?.[b.property];
      if (typeof v !== 'number') continue;
      $(`${b.asset}-${b.node}`).textContent = v.toFixed(2);
      const x = THREE.MathUtils.clamp((v - b.min) / (b.max - b.min), 0, 1);
      color.setHSL(0.33 * (1 - x), 0.8, 0.45);   // зелений → червоний
      if (station.paint(b.asset, b.node, color)) bound++;
    }
    $('bound').textContent = `${bound} з ${cfg.bindings.length}`;
    if (thing._revision !== undefined) $('rev').textContent = thing._revision;
    sourceTs = f.sync?.properties?.ts ?? sourceTs;
  }

  const api = '/api/2/things';              // проксі web: лише читання
  fetch(`${api}/${cfg.thing}?fields=features,_revision`)
    .then((r) => r.json()).then(apply);
  const events = new EventSource(
    `${api}?ids=${cfg.thing}&fields=features,_revision`);
  events.onmessage = (e) => { if (e.data) apply(JSON.parse(e.data)); };

  setInterval(() => {                       // давність даних, 4 рази на секунду
    if (!sourceTs) return;
    const age = (Date.now() - sourceTs) / 1000;
    $('age').textContent = `${age.toFixed(1)} с`;
    $('age').className = age < 2 ? '' : 'stale';
  }, 250);
}
