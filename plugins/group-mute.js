const config = require('../config')
const { cmd, commands } = require('../command')
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson} = require('../lib/functions')

// Helper to check admin status by both JID and LID, and allow config.lid
function isParticipantAdmin(participants, jidOrLid) {
    return participants.some(p =>
        (p.id === jidOrLid || p.lid === jidOrLid) && (p.admin === 'admin' || p.admin === 'superadmin')
    );
}
function isBotOwnerOrLidAdmin(participants, botOwnerJid, lid) {
    return participants.some(p =>
        ((p.id === botOwnerJid || p.lid === botOwnerJid || (lid && (p.id === lid || p.lid === lid))) &&
        (p.admin === 'admin' || p.admin === 'superadmin'))
    );
}

cmd({
    pattern: "mute",
    alias: ["groupmute"],
    desc: "Mute the group (Only admins can send messages).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🔇",
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
        if (!isAdmins) return reply("❌ Only group admins can use this command.");
        if (!isBotAdmins) return reply("❌ I need to be an admin to mute the group.");
        await conn.groupSettingUpdate(from, "announcement");
        reply("✅ Group has been muted. Only admins can send messages.");
    } catch (e) {
        console.error("Error muting group:", e);
        reply("❌ Failed to mute the group. Please try again.");
    }
});
