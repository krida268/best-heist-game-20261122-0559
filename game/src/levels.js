// Definisi tiga ruangan galeri. Peta ditulis sebagai 10 baris x 20 kolom:
//   '#' dinding, '.' lantai, ',' zona bayangan (tempat sembunyi),
//   'D' etalase (penghalang pandangan), 'P' awal pencuri, 'E' pintu keluar,
//   'L' loot, 'G' titik awal penjaga, 'C' kamera pengawas.
// Nilai loot dan rute patroli ditulis terpisah agar mudah dibaca dan diubah.

export const TILE = 64;
export const COLS = 20;
export const ROWS = 10;
export const FIELD_Y = 72; // HUD 72 px di atas area bermain (1280 x 640).

export const LEVELS = [
  {
    name: 'Galeri Senja',
    sub: 'Ruang pamer utama — satu penjaga, satu kamera',
    rows: [
      '####################',
      '#P....#....L.......#',
      '#.....#...........C#',
      '#..,,,....####.....#',
      '#..,,,....#..#..G..#',
      '#........#..#......#',
      '#.#####..#..#..,,..#',
      '#.#L....D....#..,,.#',
      '#.#..E..#....L.....#',
      '####################',
    ],
    lootValues: [150, 300, 500],
    guards: [
      { waypoints: [[16, 4], [16, 7], [14, 7], [14, 4]], speed: 52, pause: 1.1 },
    ],
    cameras: [
      { tile: [18, 2], baseAngle: Math.PI, sweep: 0.95, speed: 0.55, phase: 0 },
    ],
  },
  {
    name: 'Ruang Permata',
    sub: 'Dua penjaga berpatroli silang, dua kamera berputar',
    rows: [
      '####################',
      '#P...#......L......#',
      '#....#...####..L...#',
      '#.##....#....#..C..#',
      '#.#..G..#....#.....#',
      '#.#.....#..,,#.....#',
      '#...####...,,#.##C.#',
      '#.L......D....#L...#',
      '#....E..#..G..#....#',
      '####################',
    ],
    lootValues: [200, 250, 400, 600],
    guards: [
      { waypoints: [[5, 4], [4, 1], [3, 1], [3, 4]], speed: 58, pause: 0.9 },
      { waypoints: [[11, 8], [11, 5], [9, 5], [9, 8]], speed: 58, pause: 0.9 },
    ],
    cameras: [
      { tile: [16, 3], baseAngle: Math.PI, sweep: 1.0, speed: 0.7, phase: 0 },
      { tile: [17, 6], baseAngle: Math.PI, sweep: 0.9, speed: 0.6, phase: 1.4 },
    ],
  },
  {
    name: 'Bilik Brankas',
    sub: 'Tiga penjaga, kamera ganda — brankas utama di ujung',
    rows: [
      '####################',
      '#P....#...L....#...#',
      '#.....#...L....#C..#',
      '#..##...####...#C..#',
      '#..#..G....#...#L..#',
      '#..#..G....#..,,#..#',
      '#..####..###..,,#..#',
      '#.L....D.....#.....#',
      '#....E....G...#.L..#',
      '####################',
    ],
    lootValues: [250, 300, 400, 500, 800],
    guards: [
      { waypoints: [[7, 2], [7, 5], [6, 5]], speed: 64, pause: 0.7 },
      { waypoints: [[12, 2], [12, 7], [14, 7], [14, 2]], speed: 64, pause: 0.7 },
      { waypoints: [[10, 8], [7, 8]], speed: 60, pause: 0.8 },
    ],
    cameras: [
      { tile: [16, 2], baseAngle: Math.PI, sweep: 1.05, speed: 0.8, phase: 0 },
      { tile: [16, 3], baseAngle: -Math.PI / 2, sweep: 0.9, speed: 0.65, phase: 2.1 },
    ],
  },
];

// Mengurai satu definisi level menjadi data siap main: petak, posisi awal,
// daftar loot (dengan nilai), penjaga, kamera, dan pintu keluar.
export function parseLevel(def) {
  if (def.rows.length !== ROWS) throw new Error(`level ${def.name}: butuh ${ROWS} baris`);
  const tiles = [];
  const loot = [];
  const guards = [];
  const cameras = [];
  let playerStart = null;
  let exit = null;
  def.rows.forEach((row, y) => {
    if (row.length !== COLS) throw new Error(`level ${def.name} baris ${y}: panjang ${row.length}, harus ${COLS}`);
    const line = [];
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      if (ch === 'P') { playerStart = { x, y }; line.push('.'); }
      else if (ch === 'E') { exit = { x, y }; line.push('.'); }
      else if (ch === 'L') { loot.push({ x, y, value: def.lootValues[loot.length] ?? 100, taken: false }); line.push('.'); }
      else if (ch === 'G') { line.push('.'); }
      else if (ch === 'C') { line.push('.'); }
      else line.push(ch);
    }
    tiles.push(line);
  });
  if (!playerStart || !exit) throw new Error(`level ${def.name}: butuh P dan E`);
  def.guards.forEach((g, i) => {
    const start = g.waypoints[0];
    guards.push({
      id: i,
      waypoints: g.waypoints.map(([wx, wy]) => ({ x: (wx + 0.5) * TILE, y: FIELD_Y + (wy + 0.5) * TILE })),
      at: 0,
      x: (start[0] + 0.5) * TILE,
      y: FIELD_Y + (start[1] + 0.5) * TILE,
      angle: 0,
      speed: g.speed,
      pause: g.pause,
      wait: 0,
      alert: 0,
    });
  });
  def.cameras.forEach((c, i) => {
    cameras.push({
      id: i,
      x: (c.tile[0] + 0.5) * TILE,
      y: FIELD_Y + (c.tile[1] + 0.5) * TILE,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      speed: c.speed,
      phase: c.phase,
      angle: c.baseAngle,
    });
  });
  return {
    name: def.name,
    sub: def.sub,
    tiles,
    loot,
    guards,
    cameras,
    playerStart: { x: (playerStart.x + 0.5) * TILE, y: FIELD_Y + (playerStart.y + 0.5) * TILE },
    exit: { x: (exit.x + 0.5) * TILE, y: FIELD_Y + (exit.y + 0.5) * TILE },
  };
}

// Petak di koordinat tile; di luar peta dianggap dinding.
export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.tiles[ty][tx];
}

// Benar bila petak bisa dilalui pencuri maupun penjaga.
export function walkable(level, tx, ty) {
  const t = tileAt(level, tx, ty);
  return t === '.' || t === ',';
}

// Benar bila petak menghalangi pandangan (dinding atau etalase).
export function blocksSight(level, tx, ty) {
  const t = tileAt(level, tx, ty);
  return t === '#' || t === 'D';
}
