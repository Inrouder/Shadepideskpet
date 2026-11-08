// Kleine Helfer: Mathe, Zufall, Easing.
'use strict';

let _seed = null;
function setSeed(s) { _seed = s >>> 0; }
function rand() {
  if (_seed === null) return Math.random();
  _seed = (_seed + 0x6D2B79F5) >>> 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = (a, b) => a + rand() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v < 0 ? -1 : 1);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

function weighted(entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, e) => s + Math.max(0, e[1]), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const [v, w] of entries) { r -= Math.max(0, w); if (r <= 0) return v; }
  return entries[entries.length - 1][0];
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function pointIn(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

// Generator-Hilfen für geskriptete Abläufe.
function* waitFor(world, seconds) {
  let t = 0;
  while (t < seconds) { t += world.dt; yield; }
}
