// Спільне для сервера сеансу, бота й клієнта (заняття 3)
export const PORT = 8091;                    // сервер сеансу, WebSocket
export const T_SN = 50;                      // період знімків T_зн, мс (20 Гц)
export const PROFILES = {                    // модельні профілі мережі
  // Локальна мережа. m = 0 — як у методичці (відтворюваність вимірів), але
  // на Windows знімки надходять з розкидом ≈ 15 мс (роздільність таймерів),
  // і 35,5 % кадрів лишаються без новішого знімка; рішення ADR-0005 — m = 1.
  lan: { rtt: 2, jitter: 1, loss: 0, m: 0 },
  city: { rtt: 20, jitter: 5, loss: 0.005, m: 1 },       // міська широкосмугова
  mobile: { rtt: 60, jitter: 30, loss: 0.02, m: 1 },     // мобільна
};

// Траєкторія бота: еліпс 4,8 × 3 м навколо центру залу 12 × 8 м (в обхід
// агрегатів) зі швидкістю ≈ 1,5 м/с; кожні 10 с — різка зупинка на 2 с.
// Положення в момент ms.
const RX = 4.8, RZ = 3, V = 1.5, CYCLE = 10, STOP = 2;
const R = (RX + RZ) / 2;                     // середній радіус для кута
export function walk(ms) {
  const s = ms / 1000, k = Math.floor(s / CYCLE);
  const u = s - k * CYCLE;                   // секунда поточного циклу
  const path = (k * (CYCLE - STOP) + Math.min(u, CYCLE - STOP)) * V;
  const a = (path % (2 * Math.PI * R)) / R;
  return { p: [RX * Math.cos(a), 1.7, RZ * Math.sin(a)],
    steady: u > 1 && u < CYCLE - STOP };     // рух без зупинки щонайменше 1 с
}