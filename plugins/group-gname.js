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
    pattern: "updategname",
    alias: ["upgname", "gname"],
    desc: "Change the group name.",
    category: "group",
    filename: __filename,
    use: ".updategname <new_name>"
},
async (conn, mek, m, { from, isGroup, args, q, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "📝",
            key: m.key
        }
    });
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");
        // Fetch group metadata and participants
        const groupMetadata = await conn.groupMetadata(from).catch(() => null);
        if (!groupMetadata) return reply("❌ Failed to fetch group metadata.");
        const participants = groupMetadata.participants || [];
        // Get bot owner JID and lid automatically
        const botOwnerJid = conn.user.id.split(":")[0] + "@s.whatsapp.net";
        const lid = config.lid;
        // Debug: print all participant ids, lids, and admin status
        console.log('[group-gname] Group participants:');
        participants.forEach(p => {
            console.log(`  id: ${p.id}, lid: ${p.lid}, admin: ${p.admin}`);
        });
        console.log('[group-gname] botOwnerJid:', botOwnerJid, 'lid:', lid);
        // Check admin status: allow if bot owner or lid is admin
        const isAdmin = isBotOwnerOrLidAdmin(participants, botOwnerJid, lid);
        console.log('[group-gname] isBotOwnerOrLidAdmin:', isAdmin);
        if (!isAdmin) {
            return reply("❌ Only the bot owner or lid (as admin) can use this command.");
        }
        // Bot must also be admin
        const botJid = conn.user.id;
        // Try both full botJid and split version (without device suffix)
        const botJidSplit = botJid.split(":")[0] + "@s.whatsapp.net";
        const botObj = participants.find(p => p.id === botJid || p.lid === botJid || p.id === botJidSplit || p.lid === botJidSplit);
        const isBotAdmins =
            isParticipantAdmin(participants, botJid) ||
            isParticipantAdmin(participants, botJidSplit) ||
            (botObj && (isParticipantAdmin(participants, botObj.id) || isParticipantAdmin(participants, botObj.lid))) ||
            (lid && isParticipantAdmin(participants, lid)) ||
            isParticipantAdmin(participants, botOwnerJid); // fallback to owner JID
        console.log('[group-gname] botJid:', botJid, 'botJidSplit:', botJidSplit, 'isBotAdmins:', isBotAdmins);
        if (!isBotAdmins) return reply("❌ I need to be an admin to update the group name.");
        if (!q) return reply("❌ Please provide a new group name.");

        await conn.groupUpdateSubject(from, q);
        reply(`✅ Group name has been updated to: *${q}*`);
    } catch (e) {
        console.error("Error updating group name:", e);
        reply("❌ Failed to update the group name. Please try again.");
    }
});
