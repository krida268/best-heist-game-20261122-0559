// Semua gambar digambar prosedural di canvas 2D: lantai, dinding, bayangan,
// loot, penjaga + kerucut pandang, kamera, pencuri, HUD, dan layar overlay.
// Tanpa gambar, font, atau aset luar apa pun.

import { TILE, COLS, ROWS, FIELD_Y, tileAt } from './levels.js';
import { GUARD_RANGE, GUARD_HALF, CAM_RANGE, CAM_HALF } from './engine.js';
import { speckleFor } from './rng.js';

const W = 1280;
const H = 720;

function conePath(ctx, x, y, angle, range, half) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - half, angle + half);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, half, fill) {
  conePath(ctx, x, y, angle, range, half);
  ctx.fillStyle = fill;
  ctx.fill();
}

function lootColor(value) {
  if (value >= 600) return '#ff5d8f'; // permata merah muda (paling mahal)
  if (value >= 400) return '#ffd166'; // emas
  return '#5ee6c8'; // zamrud
}

function drawLoot(ctx, x, y, value, t) {
  const color = lootColor(value);
  const bob = Math.sin(t * 2.4 + x * 0.05) * 3;
  const glow = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 34);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.fillRect(x - 34, y + bob - 34, 68, 68);
  ctx.globalAlpha = 1;
  // Berlian: dua segitiga berlawanan.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14 + bob);
  ctx.lineTo(x + 11, y + bob);
  ctx.lineTo(x, y + 13 + bob);
  ctx.lineTo(x - 11, y + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(x, y - 14 + bob);
  ctx.lineTo(x + 11, y + bob);
  ctx.lineTo(x - 11, y + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0b0e1a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(value), x, y + 30 + bob);
}

function drawGuard(ctx, g, t) {
  drawCone(ctx, g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF,
    g.alert > 0.3 ? 'rgba(255,64,64,0.20)' : 'rgba(255,214,90,0.16)');
  ctx.strokeStyle = g.alert > 0.3 ? 'rgba(255,64,64,0.5)' : 'rgba(255,214,90,0.35)';
  ctx.lineWidth = 1.5;
  conePath(ctx, g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF);
  ctx.stroke();
  // Tubuh penjaga: lingkaran seragam gelap + topi.
  ctx.fillStyle = '#2c3e6e';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a2447';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ecff';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // Arah pandang: hidung kecil + senter.
  const nx = g.x + Math.cos(g.angle) * 20;
  const ny = g.y + Math.sin(g.angle) * 20;
  ctx.fillStyle = '#ffd65a';
  ctx.beginPath();
  ctx.arc(nx, ny, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8fa3d9';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PENJAGA', g.x, g.y + 30);
}

function drawCamera(ctx, c, t) {
  drawCone(ctx, c.x, c.y, c.angle, CAM_RANGE, CAM_HALF, 'rgba(255,140,66,0.13)');
  ctx.strokeStyle = 'rgba(255,140,66,0.4)';
  ctx.lineWidth = 1.5;
  conePath(ctx, c.x, c.y, c.angle, CAM_RANGE, CAM_HALF);
  ctx.stroke();
  ctx.fillStyle = '#3a3f5c';
  ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath();
  ctx.arc(c.x + Math.cos(c.angle) * 8, c.y + Math.sin(c.angle) * 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb37a';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KAMERA', c.x, c.y - 17);
}

function drawPlayer(ctx, p, sneaking, t) {
  const r = sneaking ? 13 : 16;
  const bob = p.moving ? Math.sin(t * 10) * 1.5 : 0;
  // Bayangan lantai.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r - 2 + bob, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tubuh berkerudung gelap dengan tepi terang.
  ctx.fillStyle = '#171a2e';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = sneaking ? '#5ee6c8' : '#e8ecff';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Wajah bertopeng pucat menghadap arah gerak.
  const fx = p.x + Math.cos(p.angle) * 6;
  const fy = p.y + Math.sin(p.angle) * 6 + bob;
  ctx.fillStyle = '#f2ead8';
  ctx.beginPath();
  ctx.arc(fx, fy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#171a2e';
  ctx.beginPath();
  ctx.arc(fx - 2.5, fy - 1, 1.4, 0, Math.PI * 2);
  ctx.arc(fx + 2.5, fy - 1, 1.4, 0, Math.PI * 2);
  ctx.fill();
  if (sneaking) {
    ctx.strokeStyle = 'rgba(94,230,200,0.9)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawExit(ctx, x, y, open, t) {
  ctx.fillStyle = open ? '#12351f' : '#2a1214';
  ctx.fillRect(x - 26, y - 26, 52, 52);
  ctx.strokeStyle = open ? '#3ddc84' : '#ff6b6b';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 26, y - 26, 52, 52);
  ctx.fillStyle = open ? '#3ddc84' : '#ff6b6b';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'KELUAR' : 'TERKUNCI', x, y - 32);
  // Pintu: panah keluar bila terbuka, gembok bila terkunci.
  if (open) {
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x - 2, y - 8);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x - 2, y + 8);
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x - 7, y - 2, 14, 12);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, 6, Math.PI, 0);
    ctx.stroke();
  }
  if (open) {
    ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1;
    ctx.fillStyle = '#3ddc84';
    ctx.fillRect(x - 26, y - 26, 52, 52);
    ctx.globalAlpha = 1;
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#0d1024';
  ctx.fillRect(0, 0, W, FIELD_Y);
  ctx.strokeStyle = '#2a2f52';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, FIELD_Y);
  ctx.lineTo(W, FIELD_Y);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`Level ${game.levelIndex + 1}/3 — ${game.level.name}`, 20, 30);
  ctx.fillStyle = '#9aa3c7';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.level.sub, 20, 52);

  // Loot.
  const got = game.level.loot.filter((l) => l.taken).length;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`◆ ${got}/${game.level.loot.length}  •  $${game.lootValue}`, 480, 30);
  ctx.fillStyle = '#9aa3c7';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('E / klik: ambil loot', 480, 52);

  // Meter alarm.
  const ax = 760;
  const ay = 18;
  const aw = 220;
  ctx.fillStyle = '#1a1e38';
  ctx.fillRect(ax, ay, aw, 20);
  const frac = game.alarm / 100;
  ctx.fillStyle = game.alarm >= 70 ? '#ff4040' : game.alarm >= 40 ? '#ffb020' : '#3ddc84';
  ctx.fillRect(ax, ay, aw * frac, 20);
  ctx.strokeStyle = '#e8ecff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ax, ay, aw, 20);
  ctx.fillStyle = game.seen ? '#ff8080' : '#e8ecff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(game.seen ? `ALARM ${Math.round(game.alarm)}% — TERLIHAT ${game.seenBy.toUpperCase()}!` : `ALARM ${Math.round(game.alarm)}%`, ax, 56);

  // Waktu + skor + status menyelinap.
  ctx.fillStyle = '#e8ecff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const mm = Math.floor(game.time / 60);
  const ss = Math.floor(game.time % 60).toString().padStart(2, '0');
  ctx.fillText(`${mm}:${ss}   Skor ${game.score}`, W - 20, 30);
  ctx.fillStyle = game.sneaking ? '#5ee6c8' : '#9aa3c7';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.sneaking ? 'MENYELINAP (Shift) — sulit terlihat' : 'Shift: menyelinap  •  M: suara', W - 20, 52);
  ctx.textAlign = 'left';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,10,24,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function button(ctx, game, x, y, w, h, label, action) {
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#14101f';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  game.buttons.push({ x, y, w, h, action, label });
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, game, t) {
  game.buttons = [];
  const cx = W / 2;
  if (game.state === 'title') {
    ctx.fillStyle = 'rgba(5,6,16,0.55)';
    ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);
    panel(ctx, cx - 360, 150, 720, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PENCURI SENJA', cx, 225);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Heist di Galeri Malam — curi semua permata, lalu kabur.', cx, 265);
    ctx.fillStyle = '#9aa3c7';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('WASD / panah: bergerak      Shift: menyelinap di bayangan', cx, 305);
    ctx.fillText('E / klik: ambil loot      Klik lantai: berjalan ke sana', cx, 330);
    ctx.fillText('Hindari kerucut pandang penjaga & kamera — alarm 100% = tertangkap.', cx, 355);
    ctx.fillText('Ambil semua loot, lalu kabur lewat pintu KELUAR. 3 level menanti.', cx, 380);
    button(ctx, game, cx - 130, 420, 260, 52, 'MULAI MERAMPOK', 'start');
    ctx.fillStyle = '#9aa3c7';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Enter juga bisa memulai  •  M mematikan suara', cx, 505);
    ctx.textAlign = 'left';
  } else if (game.state === 'levelclear') {
    panel(ctx, cx - 300, 250, 600, 170);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3ddc84';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('RUANGAN BERSIH!', cx, 315);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Level ${game.levelIndex + 1} selesai — skor ${game.score}. Ruangan berikut lebih dijaga.`, cx, 355);
    ctx.textAlign = 'left';
  } else if (game.state === 'won') {
    ctx.fillStyle = 'rgba(5,6,16,0.6)';
    ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);
    panel(ctx, cx - 360, 150, 720, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3ddc84';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('PERAMPOKAN BERHASIL!', cx, 225);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`Loot $${game.lootValue}  •  Skor akhir ${game.score}`, cx, 275);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '18px system-ui, sans-serif';
    const mm = Math.floor(game.time / 60);
    const ss = Math.floor(game.time % 60).toString().padStart(2, '0');
    ctx.fillText(`Tiga galeri dikuras dalam ${mm}:${ss}. Senja pun tunduk pada pencuri.`, cx, 315);
    button(ctx, game, cx - 270, 380, 250, 52, 'MAIN LAGI', 'start');
    button(ctx, game, cx + 20, 380, 250, 52, 'ULANG LEVEL 3', 'retry');
    ctx.fillStyle = '#9aa3c7';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('R: ulangi level terakhir  •  Enter: main dari awal', cx, 470);
    ctx.textAlign = 'left';
  } else if (game.state === 'lost') {
    ctx.fillStyle = 'rgba(20,4,8,0.6)';
    ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);
    panel(ctx, cx - 360, 150, 720, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('TERTANGKAP!', cx, 225);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(game.cause === 'alarm'
      ? 'Alarm mencapai 100% — seluruh penjaga mengepungmu.'
      : 'Seorang penjaga menangkapmu di tengah ruangan.', cx, 275);
    ctx.fillStyle = '#9aa3c7';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Loot yang sempat dibawa: $${game.lootValue}  •  Level ${game.levelIndex + 1} — ${game.level.name}`, cx, 315);
    ctx.fillText('Tips: berjalanlah di zona bayangan sambil menyelinap (Shift).', cx, 345);
    button(ctx, game, cx - 270, 400, 250, 52, 'COBA LAGI', 'retry');
    button(ctx, game, cx + 20, 400, 250, 52, 'DARI AWAL', 'start');
    ctx.fillStyle = '#9aa3c7';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('R: ulangi level ini  •  Enter: mulai dari level 1', cx, 480);
    ctx.textAlign = 'left';
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(game, t) {
      const level = game.level;
      ctx.clearRect(0, 0, W, H);
      // Lantai galeri: papan gelap dengan pola catur halus + bintik acak.
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const px = x * TILE;
          const py = FIELD_Y + y * TILE;
          const ch = tileAt(level, x, y);
          if (ch === '#') {
            ctx.fillStyle = '#232847';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#2e3460';
            ctx.fillRect(px, py, TILE, 8);
            ctx.fillStyle = '#1a1e38';
            ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 16);
          } else {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#181c36' : '#151830';
            ctx.fillRect(px, py, TILE, TILE);
            const sp = speckleFor(game.levelIndex, x * ROWS + y, game.seed);
            if (sp > 0.72) {
              ctx.fillStyle = 'rgba(255,255,255,0.05)';
              ctx.fillRect(px + 8 + sp * 30, py + 10 + sp * 26, 5, 5);
            }
            if (ch === ',') {
              // Zona bayangan: gelap, bergaris, tempat sembunyi.
              ctx.fillStyle = 'rgba(4,8,20,0.55)';
              ctx.fillRect(px, py, TILE, TILE);
              ctx.strokeStyle = 'rgba(94,230,200,0.25)';
              ctx.lineWidth = 1;
              for (let i = -TILE; i < TILE; i += 12) {
                ctx.beginPath();
                ctx.moveTo(px + i, py + TILE);
                ctx.lineTo(px + i + TILE, py);
                ctx.stroke();
              }
            } else if (ch === 'D') {
              // Etalase kaca di tengah ruangan.
              ctx.fillStyle = '#10142a';
              ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
              ctx.strokeStyle = '#5ee6c8';
              ctx.lineWidth = 2;
              ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
              ctx.fillStyle = 'rgba(94,230,200,0.18)';
              ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
              ctx.fillStyle = '#5ee6c8';
              ctx.font = 'bold 9px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('ETALASE', px + TILE / 2, py + TILE / 2 + 3);
              ctx.textAlign = 'left';
            }
          }
        }
      }

      // Target klik: cincin kecil di lantai.
      // (Disimpan di game lewat input; digambar di main.js lewat snapshot — dilewati di sini.)

      const remaining = level.loot.filter((l) => !l.taken).length;
      drawExit(ctx, level.exit.x, level.exit.y, remaining === 0, t);
      for (const item of level.loot) {
        if (!item.taken) drawLoot(ctx, (item.x + 0.5) * TILE, FIELD_Y + (item.y + 0.5) * TILE, item.value, t);
      }
      for (const c of level.cameras) drawCamera(ctx, c, t);
      for (const g of level.guards) drawGuard(ctx, g, t);
      drawPlayer(ctx, game.player, game.sneaking, t);

      // Kilau sesaat saat loot diambil.
      if (game.pickupFlash > 0) {
        ctx.globalAlpha = Math.min(0.5, game.pickupFlash);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(game.player.x, game.player.y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawHud(ctx, game);
      if (game.state !== 'playing') drawOverlay(ctx, game, t);
    },
  };
}
