// Bunyi prosedural lewat WebAudio — tanpa file audio sama sekali.
// AudioContext dibuat malas (baru saat gestur pertama) supaya tidak diblokir
// browser; semua bunyi aman dipanggil sebelum itu (dilewati diam-diam).

export function createAudio() {
  let ctx = null;
  let muted = false;
  let alarmTimer = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'triangle', 0.08); },
    pickup(value) {
      // Nada naik mengikuti nilai loot: makin mahal, makin tinggi.
      const base = 520 + Math.min(420, value);
      tone(base, 0.1, 'triangle', 0.12);
      tone(base * 1.5, 0.14, 'triangle', 0.1, 0.08);
    },
    spotted() { tone(196, 0.22, 'sawtooth', 0.1); tone(147, 0.3, 'sawtooth', 0.1, 0.12); },
    caught() {
      tone(220, 0.25, 'sawtooth', 0.14);
      tone(174, 0.25, 'sawtooth', 0.14, 0.18);
      tone(110, 0.6, 'sawtooth', 0.16, 0.36);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.13));
    },
    levelClear() { tone(784, 0.12, 'triangle', 0.1); tone(1047, 0.2, 'triangle', 0.1, 0.1); },
    // Denyut alarm pelan saat alarm tinggi; dipanggil tiap frame, dijaga sendiri.
    alarmPulse(alarm) {
      if (muted || alarm < 55) return;
      const now = performance.now();
      if (alarmTimer && now - alarmTimer < 520) return;
      alarmTimer = now;
      tone(880, 0.09, 'square', 0.045);
    },
  };
}
