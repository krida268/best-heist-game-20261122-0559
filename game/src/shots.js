// Mode khusus lewat query string:
//   ?shot=start|play|end&seed=1 — bingkai deterministik untuk screenshot.
//   ?auto=win|lose — autopilot yang memainkan game sendiri (untuk uji).
//   ?seed=N — benih hiasan lantai (default 1).
// Semua mode dibaca sekali saat boot; ?shot= membekukan dunia supaya
// screenshot selalu sama, ?auto= membiarkan dunia berjalan.

export function readQuery() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot'),
    auto: q.get('auto'),
    seed: Number(q.get('seed') || 1) || 1,
  };
}

export function applyQuery(game, query) {
  if (query.shot === 'start' || query.shot === 'play' || query.shot === 'end') {
    game.setupShot(query.shot, query.seed);
  } else {
    game.seed = query.seed;
  }
  if (query.auto === 'win' || query.auto === 'lose') {
    game.auto = query.auto;
    if (game.state === 'title') game.start();
  }
}
