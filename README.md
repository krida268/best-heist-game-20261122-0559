[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/krida268/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/krida268/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# Pencuri Senja — Heist di Galeri Malam

Game heist top-down yang dimainkan di browser desktop, tanpa unduhan apa pun:
kamu pencuri yang menyelinap ke galeri di malam hari, menguras permata dari
tiga ruangan, lalu kabur sebelum alarm mencapai 100% atau penjaga menangkapmu.

Penjaga berpatroli dengan kerucut pandang yang menyapu ruangan, kamera
pengawas berputar di sudut, dan zona bayangan menjadi tempatmu bersembunyi.
Setiap loot bernilai beda — permata termahal dijaga paling ketat.

## Cara main

- **WASD / panah**: bergerak
- **Shift**: menyelinap (lebih pelan, sulit terlihat — tak terlihat sama sekali di zona bayangan)
- **E / klik loot**: ambil loot saat dekat
- **Klik lantai**: berjalan ke titik itu
- **Enter**: mulai / main lagi — **R**: ulangi level — **M**: matikan suara

Menang: ambil **semua loot** di ruangan, lalu kabur lewat pintu **KELUAR**
yang terbuka. Kalah: alarm mencapai 100% atau penjaga menyentuhmu.
Ada 3 level: Galeri Senja, Ruang Permata, dan Bilik Brankas.

## Cara menjalankan

```sh
# dari root repo ini
python3 -m http.server 8130 --directory game
# lalu buka http://localhost:8130/ di Chrome desktop
```

Atau jalankan program penyerahannya (Node 22, tanpa dependensi):

```sh
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

`main.ts` menyalin `game/` dan `screenshots/` ke direktori keluaran dan
menulis `dossier.json` memakai `vendor/makefun-game.ts` dari kit.

## Screenshot deterministik

Buka dengan query berikut untuk bingkai yang sama setiap kali:

- `?shot=start&seed=1` — layar judul di atas ruangan level 1
- `?shot=play&seed=1` — aksi di tengah ruangan (kerucut pandang, kamera, loot, alarm)
- `?shot=end&seed=1` — layar menang di atas ruangan level 3

Semua gambar, suara, dan grafis dibuat prosedural (canvas 2D + WebAudio);
game ini tidak memuat apa pun dari internet.

## Referral

Dibangun untuk bounty [Make the best heist game](https://make.fun/bounty/best-heist-game-20261122-0559)
di make.fun — referral: `enzt809f`.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
