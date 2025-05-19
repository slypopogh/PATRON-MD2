const axios = require("axios");
const config = require('../config');
const { cmd } = require('../command');
const fetch = require("node-fetch"); 

cmd({
  pattern: "ss",
  alias: ["ssweb"],
  react: "🚀",
  desc: "Download screenshot of a given link.",
  category: "other",
  use: ".ss <link>",
  filename: __filename,
},
async (conn, mek, m, {
  from, reply, q
}) => {
  if (!q) return reply("Please provide a URL to capture a screenshot.");
  if (!/^https?:\/\//.test(q)) return reply("❗ Please provide a valid URL starting with http:// or https://");

  try {
    const apiUrl = `https://flowfalcon.dpdns.org/tools/ssweb?url=${encodeURIComponent(q)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.status) return reply("❌ Failed to capture the screenshot. Please try another link.");

    const { iurl, durl, ourl } = data.result;

    const imageBuffer = await fetch(iurl).then(res => res.buffer());

    await conn.sendMessage(from, {
      image: imageBuffer,
      caption: `*📸 Screenshot Tool*\n\n🌐 *URL:* ${ourl}\n📥 *Download:* ${durl}\n\n_*© ᴘᴀᴛʀᴏɴ TᴇᴄʜＸ 🚹*_`,
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363303045895814@newsletter',
          newsletterName: "ᴘᴀᴛʀᴏɴTᴇᴄʜＸ",
          serverMessageId: 143,
        },
      },
    }, { quoted: m });

  } catch (error) {
    console.error(error);
    reply("❌ Failed to capture the screenshot. Please try again later.");
  }
});

