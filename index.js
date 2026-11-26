require('dotenv').config();
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const OpenAI = require('openai');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const PREFIX = process.env.PREFIX || '.';
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '');
const AUTH_DIR = process.env.AUTH_DIR || '/data/auth';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
let startedAt = Date.now();

const menu = `╭━━━〔 *MR-WINE-MD* 〕━━━╮
┃ Multi-Device WhatsApp Bot
┃ Prefix: ${PREFIX}
╰━━━━━━━━━━━━━━━━━━━━━━╯

*MAIN*
${PREFIX}menu
${PREFIX}ping
${PREFIX}alive
${PREFIX}runtime
${PREFIX}owner

*AI*
${PREFIX}ai <your question>

*TOOLS*
${PREFIX}calc <expression>
${PREFIX}time

*GROUP*
${PREFIX}tagall (group admins)

More categories will be added as integrations are implemented.`;

function isOwner(jid) { return OWNER && jid && jid.split('@')[0].replace(/\D/g, '') === OWNER; }
function formatUptime() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
}

async function startBot() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' }),
    printQRInTerminal: false,
    browser: ['MR-WINE-MD', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false
  });
  sock.ev.on('creds.update', saveCreds);
  if (!state.creds.registered && PAIRING_NUMBER) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PAIRING_NUMBER);
        console.log('MR-WINE-MD PAIRING CODE:', code);
      } catch (err) { console.error('Could not request pairing code:', err?.message || err); }
    }, 10000);
  }
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log('Scan this QR in WhatsApp > Linked Devices > Link a Device:'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') console.log('MR-WINE-MD connected successfully.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('WhatsApp connection closed:', code);
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
      else console.log('Logged out. Clear stored auth only if you intentionally want to pair again.');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
      if (!text.startsWith(PREFIX)) continue;
      const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
      const input = args.join(' ');
      const sender = msg.key.participant || jid;
      const owner = isOwner(sender);
      const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
      try {
        switch ((command || '').toLowerCase()) {
          case 'menu': case 'help': return await reply(menu);
          case 'ping': return await reply('🏓 Pong! MR-WINE-MD is responding.');
          case 'alive': return await reply('✅ MR-WINE-MD is online.');
          case 'runtime': return await reply(`⏱️ Uptime: ${formatUptime()}`);
          case 'owner': return await reply(OWNER ? `Owner: wa.me/${OWNER}` : 'Owner number is not configured in environment variables.');
          case 'ai':
            if (!input) return await reply(`Usage: ${PREFIX}ai ask a question`);
            if (!openai) return await reply('AI is not configured yet. Add OPENAI_API_KEY in hosting Variables.');
            const completion = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: input }] });
            return await reply(completion.choices?.[0]?.message?.content || 'No response received.');
          case 'time': return await reply(`Server time: ${new Date().toISOString()}`);
          case 'tagall': {
            if (!jid.endsWith('@g.us')) return await reply('This command works in groups only.');
            const metadata = await sock.groupMetadata(jid);
            const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(sender) && !owner) return await reply('Only group admins can use this command.');
            const mentions = metadata.participants.map(p => p.id);
            return await sock.sendMessage(jid, { text: `📢 Attention everyone\n${mentions.map(x => '@' + x.split('@')[0]).join(' ')}`, mentions }, { quoted: msg });
          }
          case 'calc': {
            if (!input || !/^[0-9+*/().%\s-]+$/.test(input)) return await reply('Usage: .calc 12*(4+2) — numbers and basic operators only.');
            // Parse only a strict arithmetic character allowlist; no identifiers or function calls.
            const result = Function(`"use strict"; return (${input})`)();
            return await reply(`🧮 ${input} = ${result}`);
          }
          default: return await reply(`Unknown command. Type ${PREFIX}menu to see available commands.`);
        }
      } catch (err) {
        console.error('Command error:', err?.message || err);
        await reply('Command failed. Check the bot logs or configuration.');
      }
    }
  });
}

startBot().catch(err => { console.error('Startup failed:', err); process.exit(1); });
