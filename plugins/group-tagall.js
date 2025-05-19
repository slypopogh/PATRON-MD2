const config = require('../config')
const { cmd, commands } = require('../command')
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson} = require('../lib/functions')

// Helper to check admin status by both JID and LID, and allow config.lid
function isParticipantAdmin(participants, jidOrLid) {
    return participants.some(p =>
        (p.id === jidOrLid || p.lid === jidOrLid) && (p.admin === 'admin' || p.admin === 'superadmin')
    );
}

// Helper to check if bot owner or lid is admin
function isBotOwnerOrLidAdmin(participants, botOwnerJid, lid) {
    return participants.some(p =>
        ((p.id === botOwnerJid || p.lid === botOwnerJid || (lid && (p.id === lid || p.lid === lid))) &&
        (p.admin === 'admin' || p.admin === 'superadmin'))
    );
}

cmd({
    pattern: "tagall",
    alias: ["gc_tagall"],
    desc: "To Tag all Members",
    category: "group",
    use: '.tagall [message]',
    filename: __filename
},
async (conn, mek, m, { from, participants, reply, isGroup, senderNumber, groupAdmins, prefix, command, args, body, isCreator }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🔊",
            key: m.key
        }
    });
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");
        
        // Robust admin check
        const groupMetadata = await conn.groupMetadata(from).catch(() => null);
        if (!groupMetadata) return reply("❌ Failed to fetch group metadata.");
        const participants = groupMetadata.participants || [];
        const botOwnerJid = conn.user.id.split(":")[0] + "@s.whatsapp.net";
        const lid = config.lid;
        const isAdmins = isBotOwnerOrLidAdmin(participants, botOwnerJid, lid);
        const botJid = conn.user.id;
        const botJidSplit = botJid.split(":")[0] + "@s.whatsapp.net";
        const botObj = participants.find(p => p.id === botJid || p.lid === botJid || p.id === botJidSplit || p.lid === botJidSplit);
        const isBotAdmins =
            isParticipantAdmin(participants, botJid) ||
            isParticipantAdmin(participants, botJidSplit) ||
            (botObj && (isParticipantAdmin(participants, botObj.id) || isParticipantAdmin(participants, botObj.lid))) ||
            (lid && isParticipantAdmin(participants, lid)) ||
            isParticipantAdmin(participants, botOwnerJid);
        
        if (!isAdmins && !isCreator) return reply("❌ Only group admins can use this command.");
        if (!isBotAdmins) return reply("❌ I need to be an admin to use this command."); 

        let groupName = groupMetadata.subject || "Unknown Group";
        let totalMembers = participants ? participants.length : 0;
        if (totalMembers === 0) return reply("❌ No members found in this group.");

        let emojis = ['📢', '🔊', '🌐', '🔰', '❤‍🩹', '🤍', '🚹', '🚹', '📝', '💗', '🔖', '🪩', '📦', '🎉', '🛡️', '💸', '⏳', '🗿', '🚀', '🎧', '🪀', '⚡', '🚩', '🍁', '🗣️', '👻', '⚠️', '🔥'];
        let randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        // Proper message extraction
        let message = body.slice(body.indexOf(command) + command.length).trim();
        if (!message) message = "Attention Everyone"; // Default message

        let teks = `▢ Group : *${groupName}*\n▢ Members : *${totalMembers}*\n▢ Message: *${message}*\n\n┌───⊷ *MENTIONS*\n`;

        for (let mem of participants) {
            if (!mem.id) continue; // Prevent undefined errors
            teks += `${randomEmoji} @${mem.id.split('@')[0]}\n`;
        }

        teks += "└──✪ PATRON ┃ MD ✪──";

        conn.sendMessage(from, { text: teks, mentions: participants.map(a => a.id) }, { quoted: mek });

    } catch (e) {
        console.error("TagAll Error:", e);
        reply(`❌ *Error Occurred !!*\n\n${e.message || e}`);
    }
});

