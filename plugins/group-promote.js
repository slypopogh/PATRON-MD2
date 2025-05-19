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
    pattern: "promote",
    alias: ["p", "makeadmin"],
    desc: "Promotes a member to group admin",
    category: "admin",
    filename: __filename
},
async(conn, mek, m, {
    from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator, isDev, isAdmins, reply
}) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "⬆️",
            key: m.key
        }
    });

    if (!isGroup) return reply("❌ This command can only be used in groups.");

    // Robust admin check
    const groupMetadata2 = await conn.groupMetadata(from).catch(() => null);
    if (!groupMetadata2) return reply("❌ Failed to fetch group metadata.");
    const participants2 = groupMetadata2.participants || [];
    const botOwnerJid = conn.user.id.split(":")[0] + "@s.whatsapp.net";
    const lid = config.lid;
    const isAdmins2 = isBotOwnerOrLidAdmin(participants2, botOwnerJid, lid);
    const botJid = conn.user.id;
    const botJidSplit = botJid.split(":")[0] + "@s.whatsapp.net";
    const botObj = participants2.find(p => p.id === botJid || p.lid === botJid || p.id === botJidSplit || p.lid === botJidSplit);
    const isBotAdmins2 =
        isParticipantAdmin(participants2, botJid) ||
        isParticipantAdmin(participants2, botJidSplit) ||
        (botObj && (isParticipantAdmin(participants2, botObj.id) || isParticipantAdmin(participants2, botObj.lid))) ||
        (lid && isParticipantAdmin(participants2, lid)) ||
        isParticipantAdmin(participants2, botOwnerJid);

    if (!isAdmins2) return reply("❌ Only group admins can use this command.");
    if (!isBotAdmins2) return reply("❌ I need to be an admin to use this command.");

    let users = [];

    // Get users to promote from reply, mention, or number
    if (m.quoted) {
        const quotedSender = m.quoted.sender || m.quoted.participant;
        if (!quotedSender) return reply("❌ Failed to get user from reply.");
        
        const participant = findParticipant(participants2, quotedSender);
        if (participant) {
            // Store both WhatsApp ID and LID for the user
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
            const participant = findParticipant(participants2, mention);
            if (participant) {
                users.push({
                    jid: participant.id,
                    lid: participant.lid,
                    mention: mention // Use original mention
                });
            } else {
                reply(`❌ Could not find user @${mention.split('@')[0]} in the group.`, { mentions: [mention] });
            }
        }
    } else if (q) {
        // Handle direct number input
        let number = q.replace(/[^0-9]/g, '');
        if (!number) return reply("❌ Please provide a valid phone number.");
        if (number.startsWith('0')) return reply("❌ Please provide the number with country code.");
        if (number.length < 10) return reply("❌ Invalid phone number format.");
        
        const participant = findParticipant(participants2, number);
        if (participant) {
            users.push({
                jid: participant.id,
                lid: participant.lid,
                mention: participant.id
            });
        } else {
            // Fallback to direct number
            const jid = number + "@s.whatsapp.net";
            users.push({
                jid: jid,
                lid: null,
                mention: jid
            });
        }
    } else {
        return reply("❌ Please reply to a message, mention a user, or provide a phone number to promote.\n\nExample: .promote 2348133729715");
    }

    if (users.length === 0) {
        return reply("❌ No valid users to promote.");
    }

    try {
        for (const user of users) {
            // Prevent promoting the bot itself
            if (user.jid.split('@')[0] === botNumber) {
                reply("❌ The bot cannot promote itself.");
                continue;
            }

            // First check WhatsApp ID for admin status
            if (isParticipantAdmin(participants2, user.jid)) {
                reply(`❌ @${user.jid.split('@')[0]} is already an admin.`, { mentions: [user.mention] });
                continue;
            }
            
            // Then check LID if available
            if (user.lid && isParticipantAdmin(participants2, user.lid)) {
                reply(`❌ User is already an admin with LID: ${user.lid}.`);
                continue;
            }

            // Add delay between promotions
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try promotion with retries
            let retries = 2;
            let success = false;
            let lastError;

            while (retries > 0 && !success) {
                try {
                    // First try WhatsApp ID
                    let result = await conn.groupParticipantsUpdate(from, [user.jid], "promote");
                    
                    if (result && result[0]?.status === '200') {
                        success = true;
                        reply(`✅ Successfully promoted @${user.jid.split('@')[0]} to admin.`, { mentions: [user.mention] });
                        break;
                    }
                    
                    // If JID fails and we have LID, try that
                    if (!success && user.lid) {
                        result = await conn.groupParticipantsUpdate(from, [user.lid], "promote");
                        if (result && result[0]?.status === '200') {
                            success = true;
                            reply(`✅ Successfully promoted user with LID: ${user.lid} to admin.`);
                            break;
                        }
                    }

                    // If both failed, throw error
                    if (!success) {
                        throw new Error(result?.[0]?.status || 'unknown_error');
                    }
                } catch (err) {
                    lastError = err;
                    retries--;
                    if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!success) {
                console.error("Promote command error:", lastError);
                if (lastError.message.includes('403')) {
                    reply("❌ Bot doesn't have sufficient permissions to promote.");
                } else if (lastError.message.includes('409')) {
                    reply("❌ User is already an admin.");
                } else {
                    const errorMsg = user.lid ? 
                        `❌ Failed to promote user (tried both JID: ${user.jid} and LID: ${user.lid}): ${lastError.message}` :
                        `❌ Failed to promote @${user.jid.split('@')[0]}: ${lastError.message}`;
                    reply(errorMsg, { mentions: [user.mention] });
                }
            }
        }
    } catch (error) {
        console.error("Promote command error:", error);
        reply(`❌ Failed to promote: ${error.message}`);
    }
});
