//*******#*****#$$$$$$$$_&
const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

const logger = pino({ level: "info" }); // Increased logging level for debugging

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function techbrosPair() {
        const sessionPath = `./session`;
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        let techbrosWeb;

        try {
            techbrosWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            techbrosWeb.ev.on('creds.update', saveCreds);

            techbrosWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    logger.info(`WhatsApp connection opened for ${techbrosWeb.user.id}`);
                    try {
                        await delay(5000); // Shortened delay

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const mega_url = await upload(fs.createReadStream(sessionPath + '/creds.json'), `${randomMegaId()}.json`);
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const prefixedSid = `TECBROS-MD~${string_session.substring(0, 8)}#${string_session.substring(8, 12)}-${string_session.substring(12)}`;
                        const user_jid = jidNormalizedUser(techbrosWeb.user.id);

                        const coolText = `_Thank you for choosing our bot🙂_:\n*TECHBROS-MD*\n\n_Please keep this session ID safe‼️_\n\`\`\`${prefixedSid}\`\`\`\nEnjoy all the awesome features of this bot🥳`;
                        const imageUrl = 'https://i.ibb.co/wrhHm9YZ/file-181.jpg';
                        const audioPath = './audio/pairing_success.mp3';
                        const audioMimetype = 'audio/mpeg';

                        try {
                            const imageMessage = await techbrosWeb.sendMessage(user_jid, {
                                image: { url: imageUrl },
                                caption: coolText,
                                quoted: {
                                    key: {
                                        fromMe: false,
                                        remoteJid: user_jid,
                                        id: 'TEMP-MESSAGE-ID-' + Date.now() // Unique temp ID
                                    },
                                    messageTimestamp: Date.now() / 1000,
                                    pushName: 'WhatsApp User'
                                }
                            });
                            logger.info(`Session ID and welcome message sent to ${user_jid}`);

                            try {
                                await techbrosWeb.sendMessage(
                                    user_jid,
                                    {
                                        audio: { url: audioPath },
                                        mimetype: audioMimetype,
                                        quoted: imageMessage // Reply to the image message
                                    }
                                );
                                logger.info(`Pairing success audio sent to ${user_jid}`);
                            } catch (audioError) {
                                logger.error("Error sending audio:", audioError);
                            }

                        } catch (messageError) {
                            logger.error("Error sending session ID or welcome message:", messageError);
                        }

                        await delay(100);
                        await removeFile(sessionPath);
                        logger.info(`Session files removed from server.`);
                        process.exit(0);

                    } catch (e) {
                        logger.error("Error during message sending:", e);
                        exec('pm2 restart techbros-md');
                    }
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    logger.warn(`Connection closed unexpectedly. Reconnecting in 10 seconds...`);
                    await delay(10000);
                    techbrosPair();
                }
            });

            if (!techbrosWeb.authState.creds.registered) {
                logger.info(`Requesting pairing code for number: ${num}`);
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                try {
                    const code = await techbrosWeb.requestPairingCode(num);
                    logger.info(`Pairing code generated: ${code}`);
                    if (!res.headersSent) {
                        await res.send({ code });
                    }
                } catch (pairingCodeError) {
                    logger.error("Error requesting pairing code:", pairingCodeError);
                    if (!res.headersSent) {
                        await res.send({ code: "Failed to generate pairing code." });
                    }
                }
            }

        } catch (err) {
            logger.error("Error during pairing process:", err);
            exec('pm2 restart techbros-md');
            await removeFile(sessionPath);
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        } finally {
            if (techbrosWeb?.ws?.readyState === 1) {
                // Ensure disconnection if still connected and not closed by the 'connection.update' event
                await techbrosWeb.ws.close();
                logger.info("WebSocket connection closed.");
            }
        }
    }
    return await techbrosPair();
});

process.on('uncaughtException', function (err) {
    logger.fatal('Uncaught exception:', err);
    exec('pm2 restart techbros-md');
});

module.exports = router;
                                
          
