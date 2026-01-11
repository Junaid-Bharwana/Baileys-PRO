
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from current directory (for index.html/index.tsx)
app.use(express.static(__dirname));

let sock = null;
let qrCode = null;
let connectionStatus = 'DISCONNECTED';

async function connectToWhatsApp() {
    // Multi-file auth state stores session in 'auth_info_baileys' folder
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp Pro', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCode = await QRCode.toDataURL(qr);
            connectionStatus = 'QR_READY';
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = 'DISCONNECTED';
            qrCode = null;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            connectionStatus = 'CONNECTED';
            qrCode = null;
            console.log('WhatsApp Connected Successfully!');
        }
    });
}

// Start Baileys connection logic
connectToWhatsApp();

// API Endpoints
app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, qr: qrCode });
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!sock || connectionStatus !== 'CONNECTED') {
        return res.status(400).json({ error: 'WhatsApp socket is not connected. Please scan QR first.' });
    }
    
    try {
        // WhatsApp ID format: number@s.whatsapp.net
        const jid = `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (err) {
        console.error('Send Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fallback to index.html for SPA behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server instance active on port ${PORT}`);
});
