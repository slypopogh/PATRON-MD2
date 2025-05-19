const { cmd } = require('../command');
const config = require('../config');

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

// Helper to find a participant by various identifiers
function findParticipant(participants, identifier) {
    // First try exact matches
    let participant = participants.find(p => 
        p.id === identifier || // Match WhatsApp ID
        p.lid === identifier  // Match LID
    );
    
    if (participant) return participant;

    // If no exact match, try number matching
    const cleanNumber = identifier.replace(/[^0-9]/g, '');
    
    // Try LID format first (for @lid mentions)
    if (identifier.includes('@lid')) {
        participant = participants.find(p => p.lid && p.lid.includes(cleanNumber));
        if (participant) return participant;
    }
    
    // Try matching by phone number in either ID or LID
    return participants.find(p => 
        (p.id && p.id.includes(cleanNumber)) || // Check number in WhatsApp ID
        (p.lid && p.lid.includes(cleanNumber))  // Check number in LID
    );
}

cmd({
    pattern: "remove",
    alias: ["kick", "fling"],
    desc: "Removes a member from the group",
    category: "admin",
    filename: __filename,
    use: ".remove <number> or reply to message"
},
async (conn, mek, m, { from, q, isGroup, isCreator, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "❌",
            key: m.key
        }
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
    if (!isBotAdmins) return reply("❌ I need to be an admin to use this command.");

    let users = [];

    // Get users to remove from reply, mention, or number
    if (m.quoted) {
        const quotedSender = m.quoted.sender || m.quoted.participant;
        if (!quotedSender) return reply("❌ Failed to get user from reply.");
        
        const participant = findParticipant(participants, quotedSender);
        if (participant) {
            users.push({
                jid: participant.id,
                lid: participant.lid,
                mention: participant.id // Use JID for mentions
            });
        } else {
            return reply("❌ Could not find that user in the group.");
        }
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        for (const mention of m.mentionedJid) {
            const participant = findParticipant(participants, mention);
            if (participant) {
                users.push({
                    jid: participant.id,
                    lid: participant.lid,
                    mention: mention
                });
            } else {
                reply(`❌ Could not find user @${mention.split('@')[0]} in the group.`, { mentions: [mention] });
            }
        }
    } else if (q) {
        let number = q.replace(/[^0-9]/g, '');
        if (!number) return reply("❌ Please provide a valid phone number.");
        if (number.startsWith('0')) number = number.substring(1); // Remove leading 0
        
        const participant = findParticipant(participants, number);
        if (participant) {
            users.push({
                jid: participant.id,
                lid: participant.lid,
                mention: participant.id
            });
        } else {
            const jid = number + "@s.whatsapp.net";
            users.push({
                jid: jid,
                lid: null,
                mention: jid
            });
        }
    } else {
        return reply("❌ Please reply to a message, mention a user, or provide a phone number to remove.");
    }

    if (users.length === 0) {
        return reply("❌ No valid users to remove.");
    }

    try {
        for (const user of users) {
            // Check if user is bot owner
            if (user.jid.split('@')[0] === botOwnerJid.split('@')[0] || 
                (config.lid && config.lid.split(",").some(l => l.trim() === user.lid))) {
                reply(`❌ Can't remove bot owner`, { mentions: [user.mention] });
                continue;
            }

            // Check if user is admin
            if (isParticipantAdmin(participants, user.jid) || (user.lid && isParticipantAdmin(participants, user.lid))) {
                reply(`❌ Can't remove admin @${user.jid.split('@')[0]}`, { mentions: [user.mention] });
                continue;
            }

            // Add delay between removals
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try removal with retries
            let retries = 2;
            let success = false;
            let lastError;

            while (retries > 0 && !success) {
                try {
                    // Try with JID first
                    let result = await conn.groupParticipantsUpdate(from, [user.jid], "remove");
                    if (result && result[0]?.status === '200') {
                        success = true;
                        reply(`✅ Successfully removed @${user.jid.split('@')[0]}`, { mentions: [user.mention] });
                        break;
                    }

                    // If JID fails and we have LID, try that
                    if (!success && user.lid) {
                        result = await conn.groupParticipantsUpdate(from, [user.lid], "remove");
                        if (result && result[0]?.status === '200') {
                            success = true;
                            reply(`✅ Successfully removed user with LID: ${user.lid}`);
                            break;
                        }
                    }

                    throw new Error(result?.[0]?.status || 'unknown_error');
                } catch (err) {
                    lastError = err;
                    retries--;
                    if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!success) {
                if (lastError.data === 408) {
                    reply("❌ Can't remove user: They were recently added");
                } else if (lastError.data === 401) {
                    reply("❌ Bot needs to be admin to remove members");
                } else {
                    const errorMsg = user.lid ? 
                        `❌ Failed to remove user (tried both JID: ${user.jid} and LID: ${user.lid}): ${lastError.message}` :
                        `❌ Failed to remove @${user.jid.split('@')[0]}: ${lastError.message}`;
                    reply(errorMsg, { mentions: [user.mention] });
                }
            }
        }
    } catch (error) {
        console.error("Remove command error:", error);
        reply(`❌ Failed to remove member(s): ${error.message}`);
    }
});
