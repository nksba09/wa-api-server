const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function connectToWhatsApp() {
    // Auth folder jahan login save hoga
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR band, hum Pairing Code use karenge
        logger: pino({ level: 'silent' }),
        browser: ["MatchFlow Server", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected Successfully!');
        }
    });

    // 1. Pairing Code Pane ke liye API
    // Link: /pair?phone=919999999999
    app.get('/pair', async (req, res) => {
        const phone = req.query.phone;
        if (!phone) return res.send("Phone number daalo url me: /pair?phone=91XXXXXXXXXX");

        if (!sock.authState.creds.registered) {
            try {
                const code = await sock.requestPairingCode(phone);
                res.send({ status: "success", code: code });
            } catch (err) {
                res.send({ status: "error", message: err.message });
            }
        } else {
            res.send({ status: "error", message: "Pehle se connected hai!" });
        }
    });

    // 2. Message Bhejne ke liye API
    app.post('/send-message', async (req, res) => {
        const { number, message } = req.body;
        if (!number || !message) return res.status(400).json({ error: 'Number and Message required' });

        const id = number + "@s.whatsapp.net";
        try {
            await sock.sendMessage(id, { text: message });
            res.json({ status: 'success', message: 'Message Sent' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.toString() });
        }
    });
}

connectToWhatsApp();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
