/**
 * ╔══════════════════════════════════════╗
 * ║        WHATSAPP BOT - PRIVATE        ║
 * ║     Powered by @whiskeysockets/baileys ║
 * ╚══════════════════════════════════════╝
 * Author  : Ganti nama kamu di sini
 * Version : 1.0.0
 */

'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────
//  KONFIGURASI UTAMA — EDIT DI SINI
// ──────────────────────────────────────
const CONFIG = {
  // Ganti dengan nomor WA owner (format: 628xxxxxxxx tanpa + dan @s.whatsapp.net)
  OWNER: ['6287729805594'],

  BOT_NAME: '⚡ Babu piy'
  AUTHOR: 'Piy Project',
  TESTI_LINK: 'https://whatsapp.com/channel/xxxxxxxxxxxxx', // Ganti dengan link channel/saluran kamu

  // Cooldown anti-spam (dalam milidetik)
  COOLDOWN_MS: 3000,

  // Folder session login
  AUTH_FOLDER: './auth_info_baileys',

  // File QRIS (taruh qris.jpg di folder yang sama dengan index.js)
  QRIS_FILE: './qris.jpg',

  // Nomor pembayaran
  PAYMENT_NUMBER: '085745208034',
};

// ──────────────────────────────────────
//  GLOBAL STATE
// ──────────────────────────────────────
const cooldownMap = new Map(); // anti-spam per sender

// ──────────────────────────────────────
//  LOGGER
// ──────────────────────────────────────
const logger = pino({
  level: 'silent', // ubah ke 'info' jika ingin log Baileys detail
});

// ──────────────────────────────────────
//  HELPER: Cek apakah sender adalah owner
// ──────────────────────────────────────
function isOwner(sender) {
  const normalized = sender.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
  return CONFIG.OWNER.some((o) => o.replace(/[^0-9]/g, '') === normalized);
}

// ──────────────────────────────────────
//  HELPER: Waktu Indonesia (WIB)
// ──────────────────────────────────────
function getTimeWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getShortTimeWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ──────────────────────────────────────
//  HELPER: Anti-spam cooldown
// ──────────────────────────────────────
function isOnCooldown(sender) {
  const now = Date.now();
  const last = cooldownMap.get(sender) || 0;
  if (now - last < CONFIG.COOLDOWN_MS) return true;
  cooldownMap.set(sender, now);
  return false;
}

// ──────────────────────────────────────
//  HELPER: Pairing code input dari terminal
// ──────────────────────────────────────
function question(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ──────────────────────────────────────
//  HANDLER COMMAND
// ──────────────────────────────────────
async function handleCommand(sock, msg, body, from, isGroup) {
  const cmd = body.toLowerCase().split(' ')[0];

  console.log(`[CMD] ${cmd} dari ${from} | Grup: ${isGroup}`);

  switch (cmd) {
    // ── .menu ──────────────────────────
    case '.menu': {
      let ppUrl = '';
      try {
        ppUrl = await sock.profilePictureUrl(from, 'image');
      } catch {
        ppUrl = null;
      }

      const menuText =
        `╔══════════════════════════╗\n` +
        `║       ${CONFIG.BOT_NAME}          ║\n` +
        `╚══════════════════════════╝\n\n` +
        `👤 *Pembuat:* ${CONFIG.AUTHOR}\n` +
        `📱 *Owner:* wa.me/${CONFIG.OWNER[0]}\n` +
        `🕐 *Waktu:* ${getTimeWIB()}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *DAFTAR COMMAND*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *.pay*       → Info pembayaran & QRIS\n` +
        `🔄 *.proses*    → Status: sedang diproses\n` +
        `✅ *.done*       → Status: selesai\n` +
        `🔗 *.link*      → Link invite grup\n` +
        `🔄 *.revoke*    → Reset link grup\n` +
        `📣 *.testi*     → Link channel/saluran\n` +
        `🏓 *.ping*      → Cek bot aktif\n` +
        `👤 *.owner*     → Info owner\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Private bot · Hanya untuk owner_`;

      await sock.sendMessage(from, { text: menuText });
      break;
    }

    // ── .pay ───────────────────────────
    case '.pay': {
      const qrisPath = path.resolve(CONFIG.QRIS_FILE);
      if (!fs.existsSync(qrisPath)) {
        await sock.sendMessage(from, {
          text: '⚠️ File *qris.jpg* tidak ditemukan. Taruh file tersebut di folder yang sama dengan index.js.',
        });
        break;
      }
      const caption =
        `💳 *INFORMASI PEMBAYARAN*\n\n` +
        `📲 *Nomor Pembayaran Dana & Gopay:*\n` +
        `\`085745208034\`\n\n` +
        `✅ Scan QRIS di atas atau transfer ke nomor tersebut.\n\n` +
        `📩 *Setelah transfer, kirim bukti pembayaran ke owner.*\n` +
        `👤 Owner: wa.me/${CONFIG.OWNER[0]}`;

      await sock.sendMessage(from, {
        image: { url: qrisPath },
        caption,
      });
      break;
    }

    // ── .proses ────────────────────────
    case '.proses': {
      await sock.sendMessage(from, {
        text: '🔄 *PROSES SEDANG BERJALAN...*\n\nMohon tunggu, pesananmu sedang kami proses.',
      });
      break;
    }

    // ── .done ──────────────────────────
    case '.done': {
      await sock.sendMessage(from, {
        text: `✅ *DONE*\n\n📅 Selesai pada: ${getShortTimeWIB()} WIB`,
      });
      break;
    }

    // ── .revoke ────────────────────────
    case '.revoke': {
      if (!isGroup) {
        await sock.sendMessage(from, { text: '⚠️ Command ini hanya bisa digunakan di dalam *grup*.' });
        break;
      }
      try {
        const groupMeta = await sock.groupMetadata(from);
        const botId = jidNormalizedUser(sock.user.id);
        const botInGroup = groupMeta.participants.find((p) => jidNormalizedUser(p.id) === botId);

        if (!botInGroup || botInGroup.admin === null) {
          await sock.sendMessage(from, { text: '⚠️ Bot harus menjadi *admin* grup terlebih dahulu untuk mereset link.' });
          break;
        }

        const newCode = await sock.groupRevokeInvite(from);
        await sock.sendMessage(from, {
          text: `🔄 *Link grup berhasil direset!*\n\n🔗 Link baru:\nhttps://chat.whatsapp.com/${newCode}`,
        });
      } catch (err) {
        console.error('[.revoke] Error:', err.message);
        await sock.sendMessage(from, { text: '❌ Gagal mereset link grup. Pastikan bot adalah admin.' });
      }
      break;
    }

    // ── .link ──────────────────────────
    case '.link': {
      if (!isGroup) {
        await sock.sendMessage(from, { text: '⚠️ Command ini hanya bisa digunakan di dalam *grup*.' });
        break;
      }
      try {
        const code = await sock.groupInviteCode(from);
        await sock.sendMessage(from, {
          text: `🔗 *Link Invite Grup:*\nhttps://chat.whatsapp.com/${code}`,
        });
      } catch (err) {
        console.error('[.link] Error:', err.message);
        await sock.sendMessage(from, { text: '❌ Gagal mengambil link grup. Pastikan bot adalah admin.' });
      }
      break;
    }

    // ── .testi ─────────────────────────
    case '.testi': {
      await sock.sendMessage(from, {
        text:
          `📣 *CHANNEL / SALURAN*\n\n` +
          `Kunjungi saluran kami untuk testimoni dan update terbaru:\n\n` +
          `🔗 ${CONFIG.TESTI_LINK}`,
      });
      break;
    }

    // ── .ping ──────────────────────────
    case '.ping': {
      const start = Date.now();
      await sock.sendMessage(from, { text: '🏓 *Pong!*' });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `⚡ Response time: *${latency}ms*\n✅ Bot online!` });
      break;
    }

    // ── .owner ─────────────────────────
    case '.owner': {
      await sock.sendMessage(from, {
        text:
          `👤 *INFO OWNER*\n\n` +
          `📛 Nama: ${CONFIG.AUTHOR}\n` +
          `📱 WA: wa.me/${CONFIG.OWNER[0]}\n\n` +
          `_Hubungi owner untuk info lebih lanjut._`,
      });
      break;
    }

    default:
      // Bukan command yang dikenal — diam saja
      break;
  }
}

// ──────────────────────────────────────
//  FUNGSI UTAMA: Start Bot
// ──────────────────────────────────────
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`\n🔌 Menggunakan Baileys versi WA: ${version.join('.')}\n`);

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false, // kita pakai pairing code
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    retryRequestDelayMs: 2000,
    emitOwnEvents: false,
  });

  // ── Pairing Code (jika belum login) ─
  if (!sock.authState.creds.registered) {
    const phoneNumber = await question('📱 Masukkan nomor WA owner (format: 628xxxxxxxx): ');
    const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
    console.log(`\n🔑 PAIRING CODE kamu: *${code}*`);
    console.log('👉 Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan Nomor Telepon\n');
  }

  // ── Simpan kredensial ────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Event koneksi ────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('✅ Bot berhasil terhubung ke WhatsApp!\n');
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      console.log(`\n⚠️  Koneksi terputus. Alasan: ${reason}`);

      if (shouldReconnect) {
        console.log('🔄 Mencoba reconnect dalam 5 detik...\n');
        setTimeout(startBot, 5000);
      } else {
        console.log('🚫 Sesi logout. Hapus folder auth_info_baileys dan jalankan ulang.\n');
        process.exit(0);
      }
    }
  });

  // ── Event pesan masuk ────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue; // abaikan pesan dari bot sendiri

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from; // sender di grup vs pribadi
        const isGroup = from.endsWith('@g.us');

        // ── PRIVATE BOT: hanya respon owner ──
        if (!isOwner(sender)) return;

        // ── Ambil teks pesan ──────────────
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '';

        if (!body.startsWith('.')) return; // hanya proses command yang diawali titik

        // ── Anti-spam cooldown ────────────
        if (isOnCooldown(sender)) {
          console.log(`[COOLDOWN] ${sender} terlalu cepat.`);
          return;
        }

        await handleCommand(sock, msg, body.trim(), from, isGroup);
      } catch (err) {
        console.error('[MSG ERROR]', err.message);
      }
    }
  });
}

// ──────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ──────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('❌ [uncaughtException]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ [unhandledRejection]', reason);
});

// ──────────────────────────────────────
//  START
// ──────────────────────────────────────
startBot().catch((err) => {
  console.error('❌ Fatal error saat start bot:', err.message);
  process.exit(1);
});
