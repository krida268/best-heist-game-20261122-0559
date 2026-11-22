// Mesin permainan: status, gerak, tabrakan, kerucut pandang penjaga/kamera,
// meter alarm, loot, menang/kalah, plus autopilot untuk uji otomatis dan
// mode ?shot= untuk screenshot deterministik.

import { LEVELS, TILE, COLS, ROWS, FIELD_Y, parseLevel, tileAt, walkable, blocksSight } from './levels.js';

export const WALK_SPEED = 178;
export const SNEAK_SPEED = 96;
export const PLAYER_R = 16;
export const GUARD_RANGE = 208;
export const GUARD_HALF = 0.62;
export const CAM_RANGE = 228;
export const CAM_HALF = 0.55;
const ALARM_LIGHT = 30; // per detik saat terlihat di area terang
const ALARM_SHADOW = 11; // per detik saat terlihat di bayangan
const ALARM_DECAY = 7;
const CATCH_DIST = 27;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Apakah ada dinding/etalase di antara dua titik (diuji tiap 8 px).
export function hasLineOfSight(level, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor((y - FIELD_Y) / TILE);
    if (blocksSight(level, tx, ty)) return false;
  }
  return true;
}

// Apakah pengamat di (ox,oy) menghadap `angle` bisa melihat titik (px,py).
function inCone(level, ox, oy, angle, range, half, px, py, targetHidden) {
  if (targetHidden) return false;
  const d = dist(ox, oy, px, py);
  if (d > range) return false;
  if (Math.abs(angleDiff(Math.atan2(py - oy, px - ox), angle)) > half) return false;
  return hasLineOfSight(level, ox, oy, px, py);
}

// Petak di bawah titik (px,py) adalah zona bayangan?
function inShadow(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - FIELD_Y) / TILE);
  return tileAt(level, tx, ty) === ',';
}

// Jalur kabur: BFS berbiaya menuju petak aman terdekat — petak yang jauh
// dari semua penjaga DAN di luar kerucut pandang. Biaya tiap langkah naik
// tajam bila petak itu disapu kerucut, dekat penjaga, atau dilintasi patroli,
// supaya rutenya sendiri aman, bukan hanya tujuannya.
function findFleePath(game, fromTx, fromTy) {
  const level = game.level;
  const key = (x, y) => `${x},${y}`;
  const pxOf = (tx) => (tx + 0.5) * TILE;
  const pyOf = (ty) => FIELD_Y + (ty + 0.5) * TILE;
  const guardDist = (tx, ty) => {
    let m = Infinity;
    for (const g of level.guards) m = Math.min(m, dist(pxOf(tx), pyOf(ty), g.x, g.y));
    return m;
  };
  const onPatrol = (tx, ty) => level.guards.some((g) => g.path && g.path.some((n) => Math.floor(n.x / TILE) === tx && Math.floor((n.y - FIELD_Y) / TILE) === ty));
  const isSafe = (tx, ty) => guardDist(tx, ty) > 190 && !game.coneAt(pxOf(tx), pyOf(ty));
  const cost = new Map([[key(fromTx, fromTy), 0]]);
  const prev = new Map();
  const queue = [[fromTx, fromTy, 0]];
  const seen = new Set([key(fromTx, fromTy)]);
  while (queue.length) {
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      if (cost.get(key(queue[i][0], queue[i][1])) < cost.get(key(queue[best][0], queue[best][1]))) best = i;
    }
    const [cx, cy, steps] = queue.splice(best, 1)[0];
    if (steps > 0 && isSafe(cx, cy)) {
      const path = [];
      let cur = key(cx, cy);
      while (cur) {
        const [x, y] = cur.split(',').map(Number);
        path.unshift({ x: pxOf(x), y: pyOf(y) });
        cur = prev.get(cur);
      }
      path.shift(); // tanpa petak awal
      return path;
    }
    if (steps >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(level, nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      let step = 1;
      if (game.coneAt(pxOf(nx), pyOf(ny))) step += 100;
      if (guardDist(nx, ny) < 140) step += 100;
      if (onPatrol(nx, ny)) step += 40;
      cost.set(key(nx, ny), cost.get(key(cx, cy)) + step);
      prev.set(key(nx, ny), key(cx, cy));
      queue.push([nx, ny, steps + 1]);
    }
  }
  return null;
}

// Pencarian jalur BFS di petak; petak yang sedang dalam kerucut pandang
// diberi biaya mahal supaya autopilot memilih rute yang aman (penjaga
// memanggilnya dengan avoidCones=false karena mereka tidak menghindar).
function findPath(game, fromTx, fromTy, toTx, toTy, avoidCones = true) {
  const level = game.level;
  const key = (x, y) => `${x},${y}`;
  const cost = new Map([[key(fromTx, fromTy), 0]]);
  const prev = new Map();
  const queue = [[fromTx, fromTy]];
  const seen = new Set([key(fromTx, fromTy)]);
  while (queue.length) {
    // Ambil petak termurah (grid kecil, antrean sederhana sudah cukup).
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      if (cost.get(key(queue[i][0], queue[i][1])) < cost.get(key(queue[best][0], queue[best][1]))) best = i;
    }
    const [cx, cy] = queue.splice(best, 1)[0];
    if (cx === toTx && cy === toTy) {
      const path = [];
      let cur = key(cx, cy);
      while (cur) {
        const [x, y] = cur.split(',').map(Number);
        path.unshift({ x: (x + 0.5) * TILE, y: FIELD_Y + (y + 0.5) * TILE });
        cur = prev.get(cur);
      }
      // Jalur dimulai dari simpul BERIKUTNYA, bukan petak tempat pemanggil
      // berdiri — kalau tidak, pemanggil berjalan dulu ke tengah petaknya
      // sendiri (membuang waktu, kadang justru ke arah bahaya).
      path.shift();
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(level, nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      let step = 1;
      const cxPx = (nx + 0.5) * TILE;
      const cyPx = FIELD_Y + (ny + 0.5) * TILE;
      if (avoidCones && game.coneAt(cxPx, cyPx)) step += 60; // hindari kerucut pandang
      for (const g of level.guards) if (dist(g.x, g.y, cxPx, cyPx) < 150) step += 25;
      cost.set(key(nx, ny), cost.get(key(cx, cy)) + step);
      prev.set(key(nx, ny), key(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function createGame(audio) {
  const game = {
    state: 'title', // title | playing | levelclear | won | lost
    levelIndex: 0,
    level: null,
    player: { x: 0, y: 0, angle: 0, moving: false },
    alarm: 0,
    seen: false,
    seenBy: '',
    score: 0,
    lootValue: 0,
    time: 0,
    result: null, // 'won' | 'caught'
    cause: '',
    banner: 0, // sisa waktu overlay levelclear
    pickupFlash: 0,
    frozen: false, // mode ?shot=: dunia diam, hanya digambar
    auto: null, // 'win' | 'lose' | null
    autoPath: null,
    autoReplan: 0,
    autoTarget: null,
    seed: 1,
    buttons: [], // diisi render tiap frame: {x,y,w,h,action,label}
    stats: { caughtByGuard: 0, caughtByAlarm: 0 },
  };

  function loadLevel(index) {
    game.levelIndex = index;
    game.level = parseLevel(LEVELS[index]);
    game.player.x = game.level.playerStart.x;
    game.player.y = game.level.playerStart.y;
    game.player.angle = 0;
    game.alarm = 0;
    game.seen = false;
    game.time = 0;
    game.autoPath = null;
    game.autoTarget = null;
  }

  game.loadLevel = loadLevel;

  game.start = () => {
    game.score = 0;
    game.lootValue = 0;
    game.result = null;
    game.cause = '';
    loadLevel(0);
    game.state = 'playing';
  };

  game.nextLevel = () => {
    if (game.levelIndex + 1 >= LEVELS.length) {
      game.state = 'won';
      game.result = 'won';
      audio.win();
    } else {
      loadLevel(game.levelIndex + 1);
      game.state = 'playing';
      audio.levelClear();
    }
  };

  game.restartLevel = () => {
    game.result = null;
    game.cause = '';
    loadLevel(game.levelIndex);
    game.state = 'playing';
  };

  // Apakah titik (px,py) sedang berada dalam kerucut pandang aktif manapun.
  game.coneAt = (px, py) => {
    const level = game.level;
    const hidden = false;
    for (const g of level.guards) {
      if (inCone(level, g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF, px, py, hidden)) return true;
    }
    for (const c of level.cameras) {
      if (inCone(level, c.x, c.y, c.angle, CAM_RANGE, CAM_HALF, px, py, hidden)) return true;
    }
    return false;
  };

  // Petak bayangan terdekat dari posisi pemain (untuk bersembunyi saat alarm tinggi).
  function nearestShadowTile() {
    const level = game.level;
    const ptx = Math.floor(game.player.x / TILE);
    const pty = Math.floor((game.player.y - FIELD_Y) / TILE);
    let best = null;
    let bestD = Infinity;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (tileAt(level, x, y) !== ',') continue;
        const d = Math.abs(x - ptx) + Math.abs(y - pty);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    return best;
  }

  function tryGrab() {
    const level = game.level;
    for (const item of level.loot) {
      if (item.taken) continue;
      if (dist(game.player.x, game.player.y, (item.x + 0.5) * TILE, FIELD_Y + (item.y + 0.5) * TILE) < 58) {
        item.taken = true;
        game.lootValue += item.value;
        game.score += item.value;
        game.pickupFlash = 0.5;
        audio.pickup(item.value);
        return true;
      }
    }
    return false;
  }
  game.tryGrab = tryGrab;

  // Gerak melingkar melawan dinding/etalase, sumbu demi sumbu.
  function moveCircle(dx, dy) {
    const p = game.player;
    const level = game.level;
    const solid = (px, py) => {
      const r = PLAYER_R - 1;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
        const tx = Math.floor((px + ox) / TILE);
        const ty = Math.floor((py + oy - FIELD_Y) / TILE);
        if (!walkable(level, tx, ty)) return true;
      }
      return false;
    };
    if (dx !== 0 && !solid(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && !solid(p.x, p.y + dy)) p.y += dy;
  }

  function updateGuards(dt) {
    for (const g of game.level.guards) {
      // Penjaga berjalan mengikuti jalur BFS antar titik patroli, jadi ia
      // selalu memutari dinding dan etalase, bukan menembusnya.
      if (g.wait > 0) {
        g.wait -= dt;
        if (g.wait <= 0) {
          g.at = (g.at + 1) % g.waypoints.length;
          g.path = null;
        }
        continue;
      }
      if (!g.path) {
        const target = g.waypoints[g.at];
        const fromTx = Math.floor(g.x / TILE);
        const fromTy = Math.floor((g.y - FIELD_Y) / TILE);
        // waypoints disimpan sebagai koordinat piksel {x, y}: ubah dulu ke petak.
        const toTx = Math.floor(target.x / TILE);
        const toTy = Math.floor((target.y - FIELD_Y) / TILE);
        g.path = findPath(game, fromTx, fromTy, toTx, toTy, false) || [];
        // Lewati simpul pertama bila itu petak tempat penjaga berdiri.
        if (g.path.length && dist(g.x, g.y, g.path[0].x, g.path[0].y) < 8) g.path.shift();
        g.pathIdx = 0;
        if (!g.path.length) { g.wait = g.pause; continue; }
      }
      const node = g.path[g.pathIdx];
      if (!node) { g.wait = g.pause; g.path = null; continue; }
      const d = dist(g.x, g.y, node.x, node.y);
      const step = g.speed * dt;
      if (d <= Math.max(step, 4)) {
        g.x = node.x;
        g.y = node.y;
        g.pathIdx++;
        if (g.pathIdx >= g.path.length) { g.wait = g.pause; g.path = null; }
      } else {
        const nx = (node.x - g.x) / d;
        const ny = (node.y - g.y) / d;
        g.x += nx * step;
        g.y += ny * step;
        g.angle = Math.atan2(ny, nx);
      }
      g.alert = Math.max(0, g.alert - dt * 0.8);
    }
  }

  function updateCameras(t) {
    for (const c of game.level.cameras) {
      c.angle = c.baseAngle + Math.sin(t * c.speed + c.phase) * c.sweep;
    }
  }

  function updateAlarm(dt) {
    const level = game.level;
    const p = game.player;
    const shadow = inShadow(level, p.x, p.y);
    const sneaking = game.sneaking;
    const hidden = shadow && sneaking;
    let seenNow = false;
    let by = '';
    for (const g of level.guards) {
      if (inCone(level, g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF, p.x, p.y, hidden)) {
        seenNow = true; by = 'penjaga'; g.alert = 1; break;
      }
    }
    if (!seenNow) {
      for (const c of level.cameras) {
        if (inCone(level, c.x, c.y, c.angle, CAM_RANGE, CAM_HALF, p.x, p.y, hidden)) {
          seenNow = true; by = 'kamera'; break;
        }
      }
    }
    game.seen = seenNow;
    game.seenBy = by;
    if (seenNow) {
      let rate = shadow ? ALARM_SHADOW : ALARM_LIGHT;
      if (sneaking) rate *= 0.7;
      game.alarm = Math.min(100, game.alarm + rate * dt);
      if (!game.alarmWarned && game.alarm >= 55) { audio.spotted(); game.alarmWarned = true; }
    } else {
      game.alarm = Math.max(0, game.alarm - ALARM_DECAY * dt);
      if (game.alarm < 40) game.alarmWarned = false;
    }
    if (game.alarm >= 100) {
      game.state = 'lost';
      game.result = 'caught';
      game.cause = 'alarm';
      game.stats.caughtByAlarm++;
      audio.caught();
    }
  }

  function autopilot(dt) {
    const level = game.level;
    const p = game.player;
    game.autoReplan -= dt;
    if (game.auto === 'lose') {
      // Kejar penjaga terdekat lewat jalur BFS (bukan garis lurus, supaya
      // tidak tersangkut dinding), sampai tertangkap.
      let nearest = null;
      let best = Infinity;
      for (const g of level.guards) {
        const d = dist(p.x, p.y, g.x, g.y);
        if (d < best) { best = d; nearest = g; }
      }
      if (!nearest) return;
      if (game.autoReplan <= 0 || !game.autoPath || !game.autoPath.length) {
        game.autoReplan = 0.4;
        const ptx = Math.floor(p.x / TILE);
        const pty = Math.floor((p.y - FIELD_Y) / TILE);
        const gtx = Math.floor(nearest.x / TILE);
        const gty = Math.floor((nearest.y - FIELD_Y) / TILE);
        game.autoPath = findPath(game, ptx, pty, gtx, gty, false) || [];
        if (game.autoPath.length && dist(p.x, p.y, game.autoPath[0].x, game.autoPath[0].y) < 8) game.autoPath.shift();
      }
      if (!game.autoPath || !game.autoPath.length) return;
      const node = game.autoPath[0];
      const d = dist(p.x, p.y, node.x, node.y);
      if (d < 8) { game.autoPath.shift(); return; }
      const step = Math.min(WALK_SPEED * dt, d);
      moveCircle(((node.x - p.x) / d) * step, ((node.y - p.y) / d) * step);
      p.angle = Math.atan2(node.y - p.y, node.x - p.x);
      p.moving = true;
      return;
    }
    // Mode menang: cari loot terdekat, lalu pintu keluar; sembunyi bila alarm tinggi.
    const ptx = Math.floor(p.x / TILE);
    const pty = Math.floor((p.y - FIELD_Y) / TILE);
    // Dekat penjaga = menyelinap (lebih sulit terlihat).
    let nearGuard = false;
    let nearestGuard = null;
    let nearestD = Infinity;
    for (const g of level.guards) {
      const d = dist(p.x, p.y, g.x, g.y);
      if (d < nearestD) { nearestD = d; nearestGuard = g; }
      if (d < 250) nearGuard = true;
    }
    game.sneaking = nearGuard;
    // Kabur ke petak aman terdekat: petak yang bisa dicapai dan jauh dari
    // semua penjaga (bukan lari membabi buta yang bisa tersangkut di sudut).
    const fleeFromGuard = () => {
      if (game.autoReplan <= 0 || game.autoTarget !== 'flee' || !game.autoPath || !game.autoPath.length) {
        game.autoReplan = 0.4;
        game.autoTarget = 'flee';
        game.autoPath = findFleePath(game, ptx, pty);
        if (game.autoPath && game.autoPath.length && dist(p.x, p.y, game.autoPath[0].x, game.autoPath[0].y) < 8) game.autoPath.shift();
      }
      if (game.autoPath && game.autoPath.length) {
        const node = game.autoPath[0];
        const d = dist(p.x, p.y, node.x, node.y);
        if (d < 8) { game.autoPath.shift(); }
        else {
          const step = Math.min(WALK_SPEED * dt, d);
          moveCircle(((node.x - p.x) / d) * step, ((node.y - p.y) / d) * step);
          p.angle = Math.atan2(node.y - p.y, node.x - p.x);
          p.moving = true;
        }
      } else {
        // Tidak ada petak aman dalam jangkauan: lari menjauhi penjaga.
        const d = Math.max(1, nearestD);
        const step = WALK_SPEED * dt;
        moveCircle(((p.x - nearestGuard.x) / d) * step, ((p.y - nearestGuard.y) / d) * step);
        p.angle = Math.atan2(p.y - nearestGuard.y, p.x - nearestGuard.x);
        p.moving = true;
      }
    };
    // Kabur hanya bila penjaga sudah sangat dekat atau pemain sedang
    // terlihat di dalam kerucut pandang; kalau tidak, bot maju simpul demi
    // simpul di bawah dan menunggu bila simpul berikut berbahaya.
    if (nearestGuard && (nearestD < 80 || game.coneAt(p.x, p.y))) {
      fleeFromGuard();
      return;
    }
    let goal = null;
    if (game.alarm > 65) {
      goal = nearestShadowTile();
    } else {
      const remaining = level.loot.filter((l) => !l.taken);
      if (remaining.length) {
        let best = null;
        let bestD = Infinity;
        for (const l of remaining) {
          const d = Math.abs(l.x - ptx) + Math.abs(l.y - pty);
          if (d < bestD) { bestD = d; best = l; }
        }
        goal = best;
      } else {
        const etx = Math.floor(level.exit.x / TILE);
        const ety = Math.floor((level.exit.y - FIELD_Y) / TILE);
        goal = { x: etx, y: ety };
      }
    }
    if (!goal) return;
    const goalKey = `${goal.x},${goal.y}`;
    if (game.autoReplan <= 0 || game.autoTarget !== goalKey || !game.autoPath || !game.autoPath.length) {
      game.autoReplan = 0.45;
      game.autoTarget = goalKey;
      game.autoPath = findPath(game, ptx, pty, goal.x, goal.y);
    }
    if (!game.autoPath || !game.autoPath.length) return;
    const node = game.autoPath[0];
    const d = dist(p.x, p.y, node.x, node.y);
    if (d < 8) { game.autoPath.shift(); return; }
    // Maju simpul demi simpul: tunggu diam-diam (sambil menyelinap) bila
    // simpul berikut sedang disapu kerucut pandang atau ada penjaga di dekatnya.
    let nodeDanger = game.coneAt(node.x, node.y);
    if (!nodeDanger) {
      for (const g of level.guards) if (dist(node.x, node.y, g.x, g.y) < 70) { nodeDanger = true; break; }
    }
    if (nodeDanger) {
      // Jangan menunggu di petak yang akan dilintasi patroli penjaga:
      // penjaga itu akan menabrak pemain. Kabur dulu, tunggu di tempat aman.
      const onPatrolPath = level.guards.some((g) => g.path && g.path.some((n) => Math.floor(n.x / TILE) === ptx && Math.floor((n.y - FIELD_Y) / TILE) === pty));
      if (onPatrolPath) {
        fleeFromGuard();
        return;
      }
      game.sneaking = true;
      p.moving = false;
      if (game.alarm <= 65) tryGrab();
      return;
    }
    // Jalan sedang bersih: bergerak cepat supaya segera lewat.
    game.sneaking = false;
    const step = Math.min(WALK_SPEED * dt, d);
    moveCircle(((node.x - p.x) / d) * step, ((node.y - p.y) / d) * step);
    p.angle = Math.atan2(node.y - p.y, node.x - p.x);
    p.moving = true;
    if (game.alarm <= 65) tryGrab();
  }

  game.update = (dt, input) => {
    if (game.frozen) return;
    if (game.state === 'levelclear') {
      game.banner -= dt;
      if (game.banner <= 0) game.nextLevel();
      return;
    }
    if (game.state !== 'playing') return;
    game.time += dt;
    game.pickupFlash = Math.max(0, game.pickupFlash - dt);
    updateGuards(dt);
    updateCameras(game.time);
    game.sneaking = input.sneaking();

    const p = game.player;
    const mv = input.moveVector();
    p.moving = false;
    if (mv.dx !== 0 || mv.dy !== 0) {
      const sp = game.sneaking ? SNEAK_SPEED : WALK_SPEED;
      moveCircle(mv.dx * sp * dt, mv.dy * sp * dt);
      p.angle = Math.atan2(mv.dy, mv.dx);
      p.moving = true;
      input.moveTarget = null;
      input.grabTarget = null;
    } else if (game.auto) {
      autopilot(dt);
    } else if (input.moveTarget) {
      const t = input.moveTarget;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < 7) {
        input.moveTarget = null;
      } else {
        const sp = game.sneaking ? SNEAK_SPEED : WALK_SPEED;
        const step = Math.min(sp * dt, d);
        moveCircle(((t.x - p.x) / d) * step, ((t.y - p.y) / d) * step);
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
        p.moving = true;
      }
      if (input.grabTarget) {
        const item = input.grabTarget;
        if (!item.taken && dist(p.x, p.y, (item.x + 0.5) * TILE, FIELD_Y + (item.y + 0.5) * TILE) < 58) {
          tryGrab();
          input.grabTarget = null;
          input.moveTarget = null;
        }
      }
    }

    updateAlarm(dt);
    if (game.state !== 'playing') return;

    // Tertangkap bila penjaga menyentuh pencuri.
    for (const g of game.level.guards) {
      if (dist(p.x, p.y, g.x, g.y) < CATCH_DIST) {
        game.state = 'lost';
        game.result = 'caught';
        game.cause = 'guard';
        game.stats.caughtByGuard++;
        audio.caught();
        return;
      }
    }

    // Menang level bila semua loot diambil lalu sampai di pintu keluar.
    const remaining = game.level.loot.filter((l) => !l.taken).length;
    if (remaining === 0 && dist(p.x, p.y, game.level.exit.x, game.level.exit.y) < 44) {
      game.score += 500;
      if (game.levelIndex + 1 >= LEVELS.length) {
        game.state = 'won';
        game.result = 'won';
        game.score += Math.max(0, Math.round((900 - game.time) * 2));
        audio.win();
      } else {
        game.state = 'levelclear';
        game.banner = 2.2;
        audio.levelClear();
      }
    }
  };

  // ---- Mode deterministik untuk screenshot dan uji (?shot= / ?auto=) ----
  game.setupShot = (mode, seed) => {
    game.seed = seed;
    game.frozen = true;
    game.auto = null;
    if (mode === 'start') {
      loadLevel(0);
      game.state = 'title';
      game.level.guards[0].angle = Math.PI * 0.75;
      game.level.cameras[0].angle = Math.PI * 0.85;
    } else if (mode === 'play') {
      loadLevel(0);
      game.state = 'playing';
      game.time = 47.3;
      game.alarm = 38;
      game.seen = true;
      game.seenBy = 'penjaga';
      game.level.loot[0].taken = true;
      game.lootValue = game.level.loot[0].value;
      game.score = game.level.loot[0].value;
      game.player.x = 12.5 * TILE;
      game.player.y = FIELD_Y + 5.5 * TILE;
      game.player.angle = Math.PI * 0.15;
      const g = game.level.guards[0];
      g.x = 15.2 * TILE;
      g.y = FIELD_Y + 4.6 * TILE;
      g.angle = Math.PI * 0.92;
      g.alert = 1;
      game.level.cameras[0].angle = Math.PI * 0.8;
    } else if (mode === 'end') {
      loadLevel(LEVELS.length - 1);
      game.state = 'won';
      game.result = 'won';
      game.time = 318.4;
      game.alarm = 12;
      for (const item of game.level.loot) item.taken = true;
      game.lootValue = game.level.loot.reduce((s, l) => s + l.value, 0);
      game.score = 3850;
      game.player.x = game.level.exit.x;
      game.player.y = game.level.exit.y;
      const g = game.level.guards[0];
      g.x = 10.5 * TILE;
      g.y = FIELD_Y + 2.5 * TILE;
      g.angle = -Math.PI * 0.4;
      game.level.cameras[0].angle = Math.PI * 1.1;
    }
  };

  game.snapshot = () => ({
    state: game.state,
    level: game.levelIndex + 1,
    levelName: game.level ? game.level.name : null,
    lootGot: game.level ? game.level.loot.filter((l) => l.taken).length : 0,
    lootTotal: game.level ? game.level.loot.length : 0,
    lootValue: game.lootValue,
    alarm: Math.round(game.alarm),
    score: game.score,
    time: Math.round(game.time * 10) / 10,
    result: game.result,
    cause: game.cause,
    player: { x: Math.round(game.player.x), y: Math.round(game.player.y) },
    frozen: game.frozen,
  });

  loadLevel(0);
  return game;
}
