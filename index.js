// ╔══════════════════════════════════════════════════════════════╗
// ║           🐰  RabbitXMD WhatsApp Pair Server                ║
// ║          Node.js + Express + Baileys | Backend              ║
// ╚══════════════════════════════════════════════════════════════╝

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const delay      = ms => new Promise(r => setTimeout(r, ms));

const app      = express();
const PORT     = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// ── Ensure /temp directory exists on startup ─────────────────────────────────
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log('[INIT] /temp directory created');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── In-memory active pairing sessions ────────────────────────────────────────
const activeSessions = new Map();

// ── Auto Cleanup: runs every 60s ─────────────────────────────────────────────
setInterval(() => {
    try {
        const now     = Date.now();
        const entries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });

        // Delete JSON session files older than 5 minutes (300,000 ms)
        for (const e of entries) {
            if (!e.isFile() || !e.name.endsWith('.json')) continue;
            const fp = path.join(TEMP_DIR, e.name);
            try {
                const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
                if (now - (d.createdAt * 1000) > 300_000) {
                    fs.unlinkSync(fp);
                    console.log(`[CLEANUP] Deleted: ${e.name}`);
                }
            } catch { try { fs.unlinkSync(fp); } catch {} }
        }

        // Delete orphan auth dirs older than 10 minutes
        for (const e of entries) {
            if (!e.isDirectory() || !e.name.startsWith('auth_')) continue;
            const dp = path.join(TEMP_DIR, e.name);
            try {
                if (now - fs.statSync(dp).mtimeMs > 600_000) {
                    fs.rmSync(dp, { recursive: true, force: true });
                    console.log(`[CLEANUP] Deleted auth dir: ${e.name}`);
                }
            } catch {}
        }
    } catch (e) { console.error('[CLEANUP]', e.message); }
}, 60_000);

// ════════════════════════════════════════════════════════════════════════
//  POST /pair  —  Generate WhatsApp Pairing Code
// ════════════════════════════════════════════════════════════════════════
app.post('/pair', async (req, res) => {
    const { number } = req.body || {};

    if (!number)
        return res.status(400).json({ success: false, error: 'Phone number is required.' });

    const clean = String(number).replace(/\D/g, '');

    if (!/^\d{7,15}$/.test(clean))
        return res.status(400).json({ success: false, error: 'Invalid phone number. Use country code + number (e.g. 919876543210).' });

    if (activeSessions.has(clean))
        return res.status(429).json({ success: false, error: 'Pairing already in progress for this number. Please wait.' });

    const authDir = path.join(TEMP_DIR, `auth_${clean}`);

    try {
        fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const logger = pino({ level: 'silent' });

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys:  makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal:      false,
            logger,
            browser:                Browsers.ubuntu('Chrome'),
            connectTimeoutMs:       60_000,
            defaultQueryTimeoutMs:  0,
            keepAliveIntervalMs:    10_000,
            syncFullHistory:        false,
            markOnlineOnConnect:    false,
            generateHighQualityLinkPreview: false,
        });

        activeSessions.set(clean, sock);
        sock.ev.on('creds.update', saveCreds);

        // ── Connection Events ─────────────────────────────────────────────
        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

            if (connection === 'open') {
                console.log(`[CONNECTED] ${clean}`);

                // Send welcome message to user's WhatsApp
                try {
                    await delay(2000);
                    await sock.sendMessage(`${clean}@s.whatsapp.net`, {
                        text: '🐰 *RabbitXMD Connected*\n\nYour bot will be started within 2 minutes.\n\nThanks for using RabbitXMD ❤️'
                    });
                    console.log(`[MSG] Welcome message sent → ${clean}`);
                } catch (e) { console.error('[MSG]', e.message); }

                // Save credentials
                await saveCreds();
                await delay(1500);

                // Consolidate multi-file auth → single JSON
                try {
                    const credsFile = path.join(authDir, 'creds.json');
                    const creds = fs.existsSync(credsFile)
                        ? JSON.parse(fs.readFileSync(credsFile, 'utf8')) : {};
                    const keys = {};
                    if (fs.existsSync(authDir)) {
                        for (const f of fs.readdirSync(authDir).filter(x => x !== 'creds.json' && x.endsWith('.json'))) {
                            try {
                                keys[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(authDir, f), 'utf8'));
                            } catch {}
                        }
                    }
                    const sessionData = {
                        sessionId: clean,
                        auth:      { creds, keys },
                        createdAt: Math.floor(Date.now() / 1000)
                    };
                    fs.writeFileSync(
                        path.join(TEMP_DIR, `${clean}.json`),
                        JSON.stringify(sessionData, null, 2)
                    );
                    console.log(`[SAVED] ${clean}.json`);
                } catch (e) { console.error('[SAVE]', e.message); }

                // Cleanup auth dir
                try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
                activeSessions.delete(clean);
                setTimeout(() => { try { sock.ws?.close(); } catch {} }, 5000);
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                console.log(`[CLOSED] ${clean} | code=${code}`);
                if (code === DisconnectReason.loggedOut || code === 401) {
                    activeSessions.delete(clean);
                    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
                }
            }
        });

        // ── Request Pairing Code ──────────────────────────────────────────
        if (!state.creds.registered) {
            await delay(1500);
            let raw;
            try {
                raw = await sock.requestPairingCode(clean);
            } catch (pairErr) {
                activeSessions.delete(clean);
                try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
                console.error('[PAIR CODE]', pairErr.message);
                return res.status(500).json({ success: false, error: 'Failed to generate pairing code. Please try again.' });
            }
            const code = raw?.match(/.{1,4}/g)?.join('-') || raw;
            return res.json({ success: true, sessionId: clean, pairCode: code });
        }

        activeSessions.delete(clean);
        return res.status(400).json({ success: false, error: 'Device already registered.' });

    } catch (err) {
        activeSessions.delete(clean);
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
        console.error('[PAIR ERROR]', err.message);
        return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
    }
});

// ════════════════════════════════════════════════════════════════════════
//  GET /api/sessions  —  List all saved sessions
// ════════════════════════════════════════════════════════════════════════
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = fs.readdirSync(TEMP_DIR)
            .filter(f => /^\d+\.json$/.test(f))
            .map(f => {
                try {
                    const d = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, f), 'utf8'));
                    return { sessionId: d.sessionId, createdAt: d.createdAt };
                } catch { return null; }
            }).filter(Boolean);
        res.json({ success: true, total: sessions.length, sessions });
    } catch { res.json({ success: true, total: 0, sessions: [] }); }
});

// ════════════════════════════════════════════════════════════════════════
//  GET /api/session/:id  —  Get specific session auth
// ════════════════════════════════════════════════════════════════════════
app.get('/api/session/:id', (req, res) => {
    const id = req.params.id;
    if (!/^\d{7,15}$/.test(id))
        return res.status(400).json({ success: false, error: 'Invalid session ID.' });

    const fp = path.resolve(TEMP_DIR, `${id}.json`);
    if (!fp.startsWith(TEMP_DIR + path.sep) && fp !== path.join(TEMP_DIR, `${id}.json`))
        return res.status(403).json({ success: false, error: 'Access denied.' });
    if (!fs.existsSync(fp))
        return res.status(404).json({ success: false, error: 'Session not found. It may have expired.' });

    try {
        const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
        res.json({ success: true, sessionId: d.sessionId, createdAt: d.createdAt, auth: d.auth });
    } catch { res.status(500).json({ success: false, error: 'Failed to read session data.' }); }
});

// ── Serve Frontend HTML ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   🐰  RabbitXMD Pair Server Started!     ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Port : ${PORT}                               ║`);
    console.log(`║  URL  : http://localhost:${PORT}              ║`);
    console.log('╚══════════════════════════════════════════╝\n');
});
