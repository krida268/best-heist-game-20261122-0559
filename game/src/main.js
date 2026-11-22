// Boot: merangkai mesin, render, masukan, dan suara; menjalankan loop
// requestAnimationFrame; menangani klik tombol overlay dan tombol aksi.

import { createGame } from './engine.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { readQuery, applyQuery } from './shots.js';
import { TILE, FIELD_Y } from './levels.js';

const canvas = document.getElementById('game');
const audio = createAudio();
const game = createGame(audio);
const render = createRenderer(canvas);
const input = createInput(canvas);
const query = readQuery();

applyQuery(game, query);

// Status permainan untuk harness uji (dan untuk debug di konsol browser).
window.__heist = game.snapshot();
window.__heistReady = false;

function refreshSnapshot() {
  window.__heist = game.snapshot();
}

// Klik pada tombol overlay (MULAI / COBA LAGI / dst.) atau pada loot.
function handleClick(click) {
  audio.unlock();
  for (const b of game.buttons) {
    if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
      audio.click();
      if (b.action === 'start') game.start();
      else if (b.action === 'retry') game.restartLevel();
      input.moveTarget = null;
      input.grabTarget = null;
      return;
    }
  }
  if (game.state !== 'playing') return;
  // Klik pada loot yang belum diambil: berjalan ke sana lalu mengambilnya.
  for (const item of game.level.loot) {
    if (item.taken) continue;
    const lx = (item.x + 0.5) * TILE;
    const ly = FIELD_Y + (item.y + 0.5) * TILE;
    if (Math.hypot(click.x - lx, click.y - ly) < 40) {
      input.grabTarget = item;
      input.moveTarget = { x: lx, y: ly };
      return;
    }
  }
}

input.onKey = (action) => {
  audio.unlock();
  if (action === 'mute') {
    const muted = audio.toggleMute();
    document.title = muted ? 'Pencuri Senja — suara mati' : 'Pencuri Senja — Heist di Galeri Malam';
    return;
  }
  if (action === 'grab') {
    if (game.state === 'playing') game.tryGrab();
    return;
  }
  if (action === 'confirm') {
    if (game.state === 'title' || game.state === 'won') game.start();
    else if (game.state === 'lost') game.restartLevel();
    return;
  }
  if (action === 'restart') {
    if (game.state === 'playing' || game.state === 'lost') game.restartLevel();
    else if (game.state === 'won') game.start();
  }
};

let last = performance.now();
let frames = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (input.clicked) {
    handleClick(input.clicked);
    input.clicked = null;
  }
  game.update(dt, input);
  render.draw(game, now / 1000);
  frames++;
  if (frames % 10 === 0) refreshSnapshot();
  requestAnimationFrame(loop);
}

refreshSnapshot();
requestAnimationFrame(loop);
// Setelah frame pertama, beri tahu harness bahwa game siap diuji.
requestAnimationFrame(() => { window.__heistReady = true; });
