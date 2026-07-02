const messagesStore = {}; // Sehemu ya kutunza ujumbe kwa muda kwenye RAM

function handleMessages(sock) {
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;

            const chatId = msg.key.remoteJid;
            const msgId = msg.key.id;

            // Epuka kujisajili ujumbe wa status
            if (chatId === 'status@broadcast') return;

            // Tunza kila ujumbe unaoingia kwenye memory kwa kutumia ID yake
            messagesStore[msgId] = msg;

            // Futa ujumbe wa zamani kwenye memory baada ya masaa 2 ili isijae sana
            setTimeout(() => {
                delete messagesStore[msgId];
            }, 2 * 60 * 60 * 1000);

        } catch (error) {
            console.error("Error kwenye kusajili ujumbe:", error);
        }
    });

    // Kusikiliza ujumbe uliofutwa (Protocol Message / Revoke)
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.clearMedia) continue;

            // Angalia kama ujumbe uliofutwa ulikuwa "protocolMessage" (Delete for everyone)
            if (update.update.message && update.update.message.protocolMessage && update.update.message.protocolMessage.type === 0) {
                const deletedMsgId = update.update.message.protocolMessage.key.id;
                const chatId = update.key.remoteJid;

                // Tafuta ule ujumbe wa asili kwenye store yetu
                const originalMsg = messagesStore[deletedMsgId];

                if (originalMsg) {
                    const sender = originalMsg.key.participant || originalMsg.key.remoteJid;
                    const senderName = originalMsg.pushName || "Mtu";
                    
                    // Kupata text yenyewe iliyofutwa
                    let deletedText = originalMsg.message.conversation || 
                                       originalMsg.message.extendedTextMessage?.text || 
                                       "Ujumbe wa Picha/Video/Audio/Faili";

                    // Kama ulikuwa ujumbe wa kawaida wa maandishi, utume urudi
                    let notification = `⚠️ *UJUMBE ULIOFUTWA* ⚠️\n\n` +
                                       `👤 *Kutoka:* @${sender.split('@')[0]}\n` +
                                       `💬 *Ujumbe:* ${deletedText}`;

                    await sock.sendMessage(chatId, { 
                        text: notification, 
                        mentions: [sender] 
                    }, { quoted: originalMsg });
                    
                    // Futa kwenye memory baada ya kuurudisha
                    delete messagesStore[deletedMsgId];
                }
            }
        }
    });
}

module.exports = { handleMessages };
