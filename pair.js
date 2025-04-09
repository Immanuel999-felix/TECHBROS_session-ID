const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
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

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function techbrosPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let techbrosWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!techbrosWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await techbrosWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            techbrosWeb.ev.on('creds.update', saveCreds);
            techbrosWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionTechbros = fs.readFileSync('./session/creds.json');
                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(techbrosWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const prefixedSid = `TECBROS-MD~${string_session.substring(0, 8)}#${string_session.substring(8, 12)}-${string_session.substring(12)}`;

                        // Send the styled text and image as a reply to the session ID
                        const coolText = `_Thank you for choosing our bot🤖_:\n*TECHBROS-MD*\n\n_Please keep this session ID safe, don't share with anyone ‼️_\n\`\`\`${prefixedSid}\`\`\`\nEnjoy all the awesome features of this bot🥳©2025`;
                        const imageUrl = 'https://i.ibb.co/wrhHm9YZ/file-181.jpg';

                        const reply = await techbrosWeb.sendMessage(user_jid, {
                            image: { url: imageUrl },
                            caption: coolText,
                            quoted: {
                                key: {
                                    fromMe: false, // It's not a message sent by the bot itself
                                    remoteJid: user_jid,
                                    id: 'TEMP-MESSAGE-ID' // You can use a temporary ID
                                },
                                messageTimestamp: Date.now() / 1000,
                                pushName: 'WhatsApp User' // Or any name
                            }
                        });

                        // Sending audio (replying to the previous message)
                        const audioPath = './audio/pairing_success.mp3';
                        const audioMimetype = 'audio/mpeg';

                        try {
                            await techbrosWeb.sendMessage(
                                user_jid,
                                {
                                    audio: { url: audioPath },
                                    mimetype: audioMimetype,
                                    quoted: reply // Reply to the styled text and image message
                                }
                            );
                        } catch (audioError) {
                            console.error("Error sending audio:", audioError);
                        }

                    } catch (e) {
                        exec('pm2 restart techbros-md');
                    }

                    await delay(100);
                    return await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    techbrosPair();
                }
            });
        } catch (err) {
            exec('pm2 restart techbros-md');
            console.log("service restarted");
            techbrosPair();
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await techbrosPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart techbros-md');
});


module.exports = router;
          
