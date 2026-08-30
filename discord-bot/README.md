# 🤖 Bot Discord Multi-Fungsi

Bot Discord lengkap dengan fitur:
- 🛡️ **Moderasi** — kick, ban, unban, mute/unmute (timeout), warn, lihat warning
- 🎵 **Music Player** — play (YouTube/Spotify/SoundCloud), skip, queue, pause/resume, volume
- 📈 **Leveling & XP** — otomatis dapat XP dari chat, rank card, leaderboard
- 💰 **Economy** — daily, work, transfer koin, bank (deposit/withdraw), leaderboard
- 👋 **Welcome & Auto-role** — pesan selamat datang custom + role otomatis untuk member baru
- 🎫 **Ticket System** — panel tombol untuk buat ticket, auto-buat channel privat, log, close
- 🚨 **Anti-Spam & Anti-Raid** — auto-mute pesan spam/mass-mention, deteksi raid join otomatis + mode lockdown
- 🎭 **Reaction Role / Role Menu** — panel select-menu untuk member pilih role sendiri
- 🎨 **Custom Embed Builder & Filter Kata Kasar** — bikin pengumuman embed cantik + auto-hapus pesan berisi kata terlarang
- 📊 **Server Stats & Analytics** — overview lengkap + voice channel yang auto-update jumlah member
- 💡 **Suggestion & Polling System** — member kirim saran (admin approve/deny), polling dengan tombol vote real-time

Dibangun dengan **Node.js + discord.js v14**.

---

## 1. Persiapan

### a. Install Node.js
Pastikan Node.js versi 18 ke atas sudah terinstall. Cek dengan:
```bash
node -v
```

### b. Buat aplikasi bot di Discord Developer Portal
1. Buka https://discord.com/developers/applications
2. Klik **New Application**, beri nama bot kamu
3. Masuk ke tab **Bot** → klik **Reset Token** → copy token-nya (ini `DISCORD_TOKEN`)
4. Di halaman yang sama, aktifkan **Privileged Gateway Intents**:
   - ✅ **Server Members Intent** (untuk welcome & auto-role)
   - ✅ **Message Content Intent** (untuk XP dari chat)
5. Di tab **General Information**, copy **Application ID** (ini `CLIENT_ID`)
6. Di tab **OAuth2 → URL Generator**:
   - Scopes: centang `bot` dan `applications.commands`
   - Bot Permissions: centang `Administrator` (paling simpel), atau minimal:
     `Manage Roles`, `Manage Channels`, `Kick Members`, `Ban Members`, `Moderate Members`, `Send Messages`, `Connect`, `Speak`, `Read Message History`, `Embed Links`
   - Copy link yang muncul di bawah, buka di browser, lalu invite bot ke server kamu

---

## 2. Install & Konfigurasi

```bash
# masuk ke folder project
cd discord-bot

# install semua dependency
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi:
```
DISCORD_TOKEN=token_bot_kamu
CLIENT_ID=application_id_kamu
GUILD_ID=id_server_kamu   # opsional, buat testing biar command langsung muncul
```

> 💡 Cara dapat `GUILD_ID`: aktifkan Developer Mode di Discord (Settings → Advanced), lalu klik kanan nama server → **Copy Server ID**.

---

## 3. Daftarkan Slash Command

```bash
npm run deploy
```
Jika `GUILD_ID` diisi, command langsung muncul di server itu. Jika dikosongkan, command didaftarkan secara global (bisa butuh waktu sampai 1 jam untuk muncul).

---

## 4. Jalankan Bot

```bash
npm start
```
Kalau berhasil, akan muncul log `✅ Bot online sebagai NamaBot#1234`.

---

## 5. Daftar Command

| Kategori | Command | Keterangan |
|---|---|---|
| Moderasi | `/mod kick` `/mod ban` `/mod unban` `/mod mute` `/mod unmute` `/mod warn` `/mod warnings` `/mod clearwarnings` | Perlu izin **Moderate Members** |
| Music | `/music play` `/music skip` `/music stop` `/music pause` `/music resume` `/music queue` `/music volume` `/music nowplaying` | Harus join voice channel dulu |
| Leveling | `/level rank` `/level leaderboard` `/level setlevel` | XP otomatis nambah tiap kirim pesan (cooldown 60 detik) |
| Economy | `/eco balance` `/eco daily` `/eco work` `/eco pay` `/eco deposit` `/eco withdraw` `/eco leaderboard` | Mata uang bisa diganti di `config.json` |
| Welcome | `/welcome set-channel` `/welcome set-message` `/welcome set-autorole` `/welcome disable-autorole` `/welcome test` `/welcome status` | Perlu izin **Manage Server** |
| Ticket | `/ticket setup` `/ticket set-log-channel` `/ticket add` `/ticket close` | `/ticket setup` mengirim panel tombol "Buat Ticket" |
| Auto-mod | `/automod antispam` `/automod antiraid` `/automod lockdown` `/automod unlock` `/automod badword-filter` `/automod badword-add/remove/list/loaddefault` `/automod status` | Semua aktif secara default kecuali filter kata kasar (perlu `loaddefault` atau `badword-add` dulu) |
| Role Menu | `/rolemenu create` `/rolemenu addrole` `/rolemenu removerole` `/rolemenu delete` `/rolemenu list` | Member pilih role lewat dropdown, role bot harus di atas role yang mau dibagikan |
| Embed | `/embed create` | Bisa atur judul, deskripsi, warna, gambar, thumbnail, footer, author, channel tujuan |
| Stats | `/stats overview` `/stats setup` `/stats disable` | `/stats setup` bikin 3 voice channel yang auto-update tiap 10 menit |
| Suggestion | `/suggest submit` `/suggest set-channel` | Ada tombol Setuju/Tolak untuk admin di tiap saran |
| Poll | `/poll create` `/poll end` | Vote pakai tombol (bukan reaction), hasil update real-time, auto-tutup saat waktu habis |

### Cara pakai fitur canggih secara singkat
- **Anti-spam/raid**: aktif otomatis. Kalau ada raid, bot auto-lockdown dan kick akun baru — bisa dimatikan dengan `/automod unlock`.
- **Filter kata kasar**: jalankan `/automod badword-loaddefault` untuk isi daftar kata default, atau tambah manual dengan `/automod badword-add`.
- **Role menu**: `/rolemenu create` dulu (catat ID pesan yang muncul), lalu `/rolemenu addrole <message_id> <role> <label>` berkali-kali untuk tiap role.
- **Stats dashboard**: `/stats setup` sekali jalan, nanti muncul 3 voice channel yang namanya otomatis update jumlah member/bot.
- **Suggestion**: admin set channel dulu (`/suggest set-channel`), member submit pakai `/suggest submit`.
- **Poll**: `/poll create` dengan minimal 2 opsi, maksimal 5, plus durasi (menit) — otomatis ditutup saat waktu habis.

---

## 6. Kustomisasi

Semua pengaturan umum ada di **`config.json`**:
- Warna embed
- Jumlah XP per pesan & cooldown
- Nama & simbol mata uang, jumlah daily/work
- Batas warning sebelum auto-mute
- Nama kategori ticket

Data (saldo, XP, warning, dll) otomatis tersimpan di **`database/bot.sqlite`** — tidak perlu setup database eksternal.

---

## 7. Struktur Folder

```
discord-bot/
├── index.js              # entry point, load semua command & event
├── deploy-commands.js    # daftarkan slash command ke Discord
├── config.json           # pengaturan umum (warna, XP, ekonomi, dll)
├── .env                  # token & ID rahasia (JANGAN dishare/upload ke publik)
├── database/
│   ├── db.js             # semua fungsi query database
│   └── bot.sqlite         # file database (dibuat otomatis)
├── commands/
│   ├── moderation.js     # /mod ...
│   ├── music.js          # /music ...
│   ├── leveling.js       # /level ...
│   ├── economy.js        # /eco ...
│   ├── welcome.js        # /welcome ...
│   └── ticket.js         # /ticket ...
└── events/
    ├── ready.js
    ├── interactionCreate.js  # handle slash command + tombol ticket
    ├── messageCreate.js      # XP gain
    └── guildMemberAdd.js     # welcome + auto-role
```

---

## 8. Troubleshooting

- **Slash command tidak muncul** → pastikan sudah `npm run deploy`, tunggu beberapa menit (atau pakai `GUILD_ID` biar instan)
- **Music tidak bisa play / error** → pastikan `ffmpeg-static` terinstall dengan benar (`npm install` ulang); beberapa hosting/VPS memblokir akses YouTube, pertimbangkan proxy/cookies jika sering gagal
- **Bot tidak kasih role/kick/ban** → cek posisi role bot di **Server Settings → Roles** harus di atas role target, dan bot punya izin yang sesuai
- **XP/level tidak jalan** → pastikan intent **Message Content** sudah diaktifkan di Developer Portal

---

Selamat pakai bot-nya! 🎉 Kalau mau nambah fitur lain (giveaway, reaction role, anti-spam, dsb) tinggal bilang saja.
