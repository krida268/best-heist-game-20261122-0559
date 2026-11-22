// Masukan keyboard + mouse. Keyboard: WASD/panah untuk bergerak, Shift untuk
// menyelinap, E mengambil loot, Enter/Spasi mulai atau lanjut, R mengulang,
// M mematikan suara. Mouse: klik lantai untuk berjalan ke sana, klik loot
// untuk berjalan lalu mengambilnya, klik tombol di layar judul/menang/kalah.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    moveTarget: null, // {x, y} dalam koordinat canvas, atau null
    grabTarget: null, // loot yang diklik, atau null
    clicked: null, // klik terakhir (untuk tombol overlay), dibersihkan tiap frame
    onKey: null, // dipanggil untuk tombol aksi sekali tekan (Enter, E, R, M)
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    const mapped = KEYMAP[e.code];
    if (mapped) keys.add(mapped);
    if (!e.repeat && state.onKey) {
      if (e.code === 'Enter' || e.code === 'Space') state.onKey('confirm');
      else if (e.code === 'KeyE') state.onKey('grab');
      else if (e.code === 'KeyR') state.onKey('restart');
      else if (e.code === 'KeyM') state.onKey('mute');
    }
  });
  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.code];
    if (mapped) keys.delete(mapped);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    state.clicked = { x, y };
    state.moveTarget = { x, y };
    state.grabTarget = null;
  });

  // Arah gerak dari tombol yang sedang ditekan, ternormalisasi.
  state.moveVector = () => {
    let dx = 0;
    let dy = 0;
    if (keys.has('left')) dx -= 1;
    if (keys.has('right')) dx += 1;
    if (keys.has('up')) dy -= 1;
    if (keys.has('down')) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    return { dx, dy };
  };

  state.sneaking = () => keys.has('sneak');

  return state;
}
