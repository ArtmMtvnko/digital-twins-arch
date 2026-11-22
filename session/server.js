// Сервер сеансу: спільний стан сцени через WebSocket (заняття 3).
// Запуск з каталогу session: node server.js
// Клієнт під’єднується: ws://localhost:8091/?name=A&profile=lan|city|mobile
import { WebSocketServer } from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PORT, T_SN, PROFILES } from '../scene/shared.js';

const poses = new Map();             // пози аватарів: власник — учасник
const marks = [];                    // позначки: джерело істини — сервер
let markId = 0, sent = 0;

// Мережа моделюється тут: кожне повідомлення затримується на RTT/2 + джитер;
// «втрачений» сегмент TCP надходить на RTT пізніше, а порядок зберігається,
// як у TCP, поверх якого працює WebSocket.
function link({ rtt, jitter, loss }) {
  let last = 0;
  return (deliver) => {
    let d = rtt / 2 + Math.random() * jitter;
    if (Math.random() < loss) d += rtt;    // повторне передавання
    last = Math.max(Date.now() + d, last);
    setTimeout(deliver, last - Date.now());
  };
}

const wss = new WebSocketServer({ port: PORT });
const broadcast = (msg) => { for (const c of wss.clients) c.post(msg); };

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://localhost').searchParams;
  const name = q.get('name')?.slice(0, 20) || 'guest';
  const profile = PROFILES[q.get('profile')] ? q.get('profile') : 'lan';
  const up = link(PROFILES[profile]), down = link(PROFILES[profile]);
  ws.post = (msg) => down(() => {
    const data = JSON.stringify(msg);
    if (ws.readyState !== ws.OPEN) return;
    ws.send(data);
    sent += data.length;
  });
  ws.name = name;
  ws.on('message', (raw) => up(() => {     // після від’єднання — не приймати
    if (ws.readyState === ws.OPEN) handle(raw);
  }));
  ws.on('close', () => poses.delete(name));
  ws.post({ type: 'marks', marks });       // новому учасникові — повний стан
  console.log(`+ ${name} (${profile}), учасників: ${wss.clients.size}`);

  function handle(raw) {                   // сервер перевіряє кожне введення
    let m;
    try { m = JSON.parse(raw); } catch {
      return console.log(`відкинуто: ${name}`);
    }
    const valid = Array.isArray(m.p) && m.p.length === 3
      && m.p.every((v) => Math.abs(v) < 1100);        // у межах території
    if (m.type === 'pose' && valid)
      poses.set(name, { p: m.p, q: m.q });
    else if (m.type === 'ping') ws.post({ type: 'pong', t: m.t });
    else if (m.type === 'mark' && valid && m.text?.length <= 80) {
      marks.push({ id: ++markId, author: name, text: m.text, p: m.p });
      broadcast({ type: 'marks', marks });
    } else if (m.type === 'unmark') {      // видалити може лише автор
      const i = marks.findIndex((k) => k.id === m.id && k.author === name);
      if (i >= 0) marks.splice(i, 1);
      broadcast({ type: 'marks', marks });
    } else if (m.type === 'report') {
      mkdirSync('../results', { recursive: true });
      const file = `../results/net-${profile}-${m.mode}.json`;
      writeFileSync(file, JSON.stringify(m, null, 2));
      console.log(`Звіт ${name}: ${file}`);
    }
  }
});

setInterval(() => {                        // знімок стану кожні T_зн мс
  const t = Date.now();
  for (const c of wss.clients) {           // K = N − 1: без власного аватара
    const avatars = Object.fromEntries(
      [...poses].filter(([who]) => who !== c.name));
    c.post({ type: 'snap', t, avatars });
  }
}, T_SN);

setInterval(() => {                        // вихідний потік сервера R_с
  if (wss.clients.size) console.log(`учасників ${wss.clients.size}, ` +
    `R_с = ${((8 * sent) / 5000).toFixed(1)} кбіт/с`);
  sent = 0;
}, 5000);
console.log(`Сервер сеансу: ws://localhost:${PORT}`);
