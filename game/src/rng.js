// Pengacak deterministik kecil (mulberry32) untuk hiasan lantai dan jitter.
// Dipakai agar mode ?shot= menghasilkan frame yang sama setiap kali dijalankan.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Angka acak 0..1 yang stabil untuk satu pasangan (level, indeks hiasan).
export function speckleFor(levelIndex, index, seed) {
  return makeRng((seed * 7919 + levelIndex * 131 + index * 17) >>> 0)();
}
