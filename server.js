
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let qrCode = null;
let connectionStatus = 'DISCONNECTED';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
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
            console.log('WhatsApp Connected!');
        }
    });
}

// Start Baileys
connectToWhatsApp();

// API Endpoints for Frontend
app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, qr: qrCode });
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!sock || connectionStatus !== 'CONNECTED') {
        return res.status(400).json({ error: 'WhatsApp not connected' });
    }
    
    try {
        const id = `${number}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Baileys Backend running on http://localhost:${PORT}`);
});
