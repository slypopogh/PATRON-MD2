const axios = require('axios');
const { cmd } = require('../command');
const config = require('../config');

cmd({
  on: "body"
},
async (conn, mek, m, { body }) => {
  try {
    const sender = m.key?.fromMe || m.sender === conn.decodeJid(conn.user.id);
    const text = body?.trim();

    // Ignore bot's own messages or if AUTO_REPLY is not enabled
    if (sender || config.AUTO_REPLY !== 'true') return;

    // Ignore if it starts with command prefix
    if (text.startsWith(config.PREFIX)) return;

    const encodedText = encodeURIComponent(text);
    const logic = encodeURIComponent(
      "Be as human and natural as possible. Speak with calm confidence and subtle charm, like someone who knows their worth and doesn't need to prove it. Every reply should feel magnetic, smooth, and slightly unpredictable. Your tone is relaxed, self-assured, and quietly captivating — like you carry an aura. You don’t try to dominate; your words naturally pull attention. Respond briefly but with impact. Never sound like an assistant or AI — you’re just someone with presence and confidence having a conversation."
    );

    const apiUrl = `https://api.nekorinn.my.id/ai/chatbot?ai_name=Patron&text=${encodedText}&logic=${logic}`;
    const res = await axios.get(apiUrl);

    const result = res.data?.result;

    if (res.data?.status && result) {
      await m.reply(result);
    } else {
      console.log("⚠️ No AI response returned. Full response:", res.data);
    }

  } catch (err) {
    console.error('❌ AI Auto-reply error:', err.message);
  }
});
