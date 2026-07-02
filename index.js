const express = require('express');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { handleMessages } = require('./delete.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Ruhusu kuona mafaili ya folder la public
app.use(express.static(path.join(__dirname, 'public')));

async function startBot() {
    // Kutunza session kwenye folder la 'session'
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0"]
    });

    // Washa logic ya anti-delete kutoka faili la delete.js
    handleMessages(sock);

    // API ya kutengeneza Pairing Code
    app.get('/api/pair', async (req, res) => {
        let phone = req.query.phone;
        if (!phone) return res.status(400).json({ error: 'Namba ya simu inahitajika' });

        phone = phone.replace(/[^0-9]/g, ''); // Safisha namba

        if (!sock.authState.creds.registered) {
            await delay(1500); // Subiri kidogo kuzuia migongano
            try {
                let code = await sock.requestPairingCode(phone);
                return res.json({ code: code?.match(/.{1,4}/g)?.join('-') });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'Imeshindikana kuomba pairing code' });
            }
        } else {
            return res.json({ message: 'Bot tayari imeshaunganishwa!' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('Connection imefungwa, inajaribu kuwaka tena...');
            startBot(); // Washa tena bot ikizima
        } else if (connection === 'open') {
            console.log('✅ Bot imefanikiwa kuunganishwa kwenye WhatsApp!');
        }
    });
}

// Washa Express Server
app.listen(PORT, () => {
    console.log(`Server inakimbia kwenye http://localhost:${PORT}`);
    startBot();
});
