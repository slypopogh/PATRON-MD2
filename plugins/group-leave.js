const { sleep } = require('../lib/functions');
const config = require('../config');
const { cmd } = require('../command');


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
    pattern: "leave",
    alias: ["left", "leftgc", "leavegc"],
    desc: "Leave the group",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isCreator, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🎉",
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

        // For leave command, only allow bot owner/lid to use it
        if (!isCreator && (!lid || lid !== sender)) {
            return reply("❌ Only the bot owner can use this command.");
        }

        await reply("👋 Leaving group...");
        await sleep(1500);
        await conn.groupLeave(from);

    } catch (e) {
        console.error("Leave error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

