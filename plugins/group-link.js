const { cmd, commands } = require('../command');
const config = require('../config');
// Helper functions
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
    pattern: "invite",
    alias: ["glink", "grouplink"],
    desc: "Get group invite link.",
    category: "group",
    filename: __filename,
}, async (conn, mek, m, { from, isGroup, isCreator, reply }) => {
    try {
        await conn.sendMessage(m.key.remoteJid, {
            react: { text: "🔗", key: m.key }
        });

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
        if (!isBotAdmins) return reply("❌ I need to be an admin to get the group link.");

        const inviteCode = await conn.groupInviteCode(from);
        if (!inviteCode) return reply("❌ Failed to retrieve the invite code.");

        return reply(`✅ *Here is your group invite link:*\nhttps://chat.whatsapp.com/${inviteCode}`);
    } catch (error) {
        console.error("Error in invite command:", error);
        reply(`❌ An error occurred: ${error.message || "Unknown error"}`);
    }
});

