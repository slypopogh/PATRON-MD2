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

// Normalize function (remove spaces, +, and leading zeros)
function normalizeNum(num) {
    if (!num) return '';
    return num.toString().replace(/[^0-9]/g, '').replace(/^0+/, '');
}

cmd({
    pattern: "add",
    alias: ["invite", "addmember"],
    desc: "Add a member to the group",
    category: "group",
    filename: __filename,
    use: '.add number or reply to message'
},
async(conn, mek, m, {
    from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator, isDev, isAdmins, reply
}) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "➕",
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
    if (!isBotAdmins2) return reply("❌ I need to be an admin to add members.");

    let users = [];

    // Get users to add from reply, mention, or number
    if (m.quoted) {
        const quotedSender = m.quoted.sender || m.quoted.participant;
        if (!quotedSender) return reply("❌ Failed to get user from reply.");
        
        const participant = findParticipant(participants2, quotedSender);
        if (participant) {
            users.push({
                jid: participant.id,
                lid: participant.lid,
                mention: participant.id
            });
        } else {
            // For add command, if user not in group, that's expected
            const jid = quotedSender.includes('@') ? quotedSender : quotedSender + "@s.whatsapp.net";
            users.push({
                jid: jid,
                lid: null,
                mention: jid
            });
        }
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        for (const mention of m.mentionedJid) {
            users.push({
                jid: mention,
                lid: null,
                mention: mention
            });
        }
    } else if (q) {
        let numbers = q.replace(/[^0-9,]/g, '').split(',');
        for (let number of numbers) {
            number = normalizeNum(number);
            if (!number) continue;
            
            const jid = number + "@s.whatsapp.net";
            users.push({
                jid: jid,
                lid: null,
                mention: jid
            });
        }
    } else {
        return reply("❌ Please reply to a message, mention users, or provide phone numbers to add.\n\nExample: .add 2348133729715,2348121234567");
    }

    if (users.length === 0) {
        return reply("❌ No valid users to add.");
    }

    try {
        for (const user of users) {
            // Check if already in group
            const isParticipant = participants2.some(p => 
                p.id === user.jid || 
                (user.lid && p.lid === user.lid)
            );

            if (isParticipant) {
                reply(`❌ @${user.jid.split('@')[0]} is already in the group.`, { mentions: [user.mention] });
                continue;
            }

            // Add delay between additions
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const result = await conn.groupParticipantsUpdate(from, [user.jid], "add");
                if (result && result[0]?.status === '200') {
                    reply(`✅ Successfully added @${user.jid.split('@')[0]} to the group.`, { mentions: [user.mention] });
                } else if (result && result[0]?.status === '403') {
                    // Privacy settings prevent direct add, try sending invite link
                    try {
                        const inviteCode = await conn.groupInviteCode(from);
                        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                        await conn.sendMessage(user.jid, { 
                            text: `You've been invited to join *${groupName}*\n\n${inviteLink}`
                        });
                        reply(`📨 User @${user.jid.split('@')[0]} has privacy settings enabled. Sent them an invite link.`, { mentions: [user.mention] });
                    } catch (inviteError) {
                        reply(`❌ Failed to send invite to @${user.jid.split('@')[0]}: ${inviteError.message}`, { mentions: [user.mention] });
                    }
                } else {
                    throw new Error(result?.[0]?.status || 'unknown_error');
                }
            } catch (error) {
                console.error("Add member error:", error);
                if (error.message.includes('403')) {
                    reply(`❌ Failed to add @${user.jid.split('@')[0]}: They have privacy settings enabled.`, { mentions: [user.mention] });
                } else if (error.message.includes('409')) {
                    reply(`❌ Failed to add @${user.jid.split('@')[0]}: Already in too many groups.`, { mentions: [user.mention] });
                } else {
                    reply(`❌ Failed to add @${user.jid.split('@')[0]}: ${error.message}`, { mentions: [user.mention] });
                }
            }
        }
    } catch (error) {
        console.error("Add command error:", error);
        reply(`❌ Failed to add member(s): ${error.message}`);
    }
});