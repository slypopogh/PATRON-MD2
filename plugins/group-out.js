const { cmd } = require('../command');
const config = require('../config');

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
    pattern: "out",
    alias: ["ck", "🦶"],
    desc: "Removes all members with specific country code from the group",
    category: "admin",
    filename: __filename
},
async (conn, mek, m, { from, q, isGroup, isCreator, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "❌",
            key: m.key
        }
    });

    // Check if the command is used in a group
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

    // This command should only be used by the bot owner
    if (!isCreator) return reply("❌ Only the bot owner can use this command.");
    if (!isBotAdmins) return reply("❌ I need to be an admin to use this command.");

    if (!q) return reply("❌ Please provide a country code. Example: .out 234");

    const countryCode = q.trim();
    if (!/^\d+$/.test(countryCode)) {
        return reply("❌ Invalid country code. Please provide only numbers (e.g., 234 for +234 numbers)");
    }

    try {
        // Filter participants to remove - excluding admins and matching country code
        const targets = participants.filter(
            participant => participant.id.startsWith(countryCode) && 
                         !isParticipantAdmin(participants, participant.id) && // Don't remove admins
                         !isParticipantAdmin(participants, participant.lid) && // Check LID too
                         participant.id !== config.lid // Don't remove config.lid
        );

        if (targets.length === 0) {
            return reply(`❌ No non-admin members found with country code +${countryCode}`);
        }

        const jids = targets.map(p => p.id);
        await conn.groupParticipantsUpdate(from, jids, "remove");
        reply(`✅ Successfully removed ${jids.length} members with country code +${countryCode}`);
        
    } catch (error) {
        console.error("Out command error:", error);
        reply(`❌ An error occurred: ${error.message}`);
    }
});
