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
    async function TechbrosPair() { // Capital "T"
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let TechbrosPairWeb = makeWASocket({ // Capital "T"
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!TechbrosPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await TechbrosPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            TechbrosPairWeb.ev.on('creds.update', saveCreds);
            TechbrosPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionTechbros = fs.readFileSync('./session/creds.json');
                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(TechbrosPairWeb.user.id);

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

                        // Send the styled text and image
                        const coolText = `_Thank you for choosing our bot🙂_:\n*TECBROS-MD*\n\n_Please keep this session ID safe‼️_\n\`\`\`${prefixedSid}\`\`\`\nEnjoy all the awesome features of this bot🥳`;
                        const imageUrl = 'YOUR_LOGO_IMAGE_URL_HERE'; // Replace with your logo image URL
                        const audioPath = './audio/pairing_success.mp3'; // Assuming the path to your audio file

                        try {
                            await TechbrosPairWeb.sendMessage(user_jid, {
                                image: { url: imageUrl },
                                caption: coolText
                            });

                            // Sending audio
                            try {
                                await TechbrosPairWeb.sendMessage(
                                    user_jid,
                                    {
                                        audio: { url: audioPath },
                                        mimetype: 'audio/mpeg' // Assuming it's an MP3
                                    }
                                );
                            } catch (audioError) {
                                console.error("Error sending audio:", audioError);
                            }

                        } catch (messageError) {
                            console.error("Error sending styled message:", messageError);
                        }

                    } catch (e) {
                        exec('pm2 restart techbros'); // Lowercase "t"
                    }

                    await delay(100);
                    return await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    TechbrosPair(); // Capital "T"
                }
            });
        } catch (err) {
            exec('pm2 restart techbros-md'); // Lowercase "t"
            console.log("service restarted");
            TechbrosPair(); // Capital "T"
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await TechbrosPair(); // Capital "T"
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart techbros'); // Lowercase "t"
});

module.exports = router;
