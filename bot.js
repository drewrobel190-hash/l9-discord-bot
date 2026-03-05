require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const cors = require("cors");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const CHANNEL_ID = process.env.CHANNEL_ID;

client.once("ready", () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.use(cors({
  origin: "https://drewrobel190-hash.github.io"
}));
app.use(express.json());

app.post("/alert", async (req, res) => {
  try {
    // ✅ simple auth
    const secret = req.headers["x-alert-secret"];
    if (secret !== process.env.ALERT_SECRET) {
      return res.sendStatus(401);
    }

    const message = req.body?.message;
    if (!message || typeof message !== "string") {
      return res.sendStatus(400);
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return res.sendStatus(404);

    await channel.send({
  content: message,
  allowedMentions: {
    parse: [], // don't allow random mentions
    roles: ["1463810381456609360"] // allow only this role
  }
});

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Alert error:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Alert server running on port " + PORT);
});

process.on("SIGINT", () => {
  console.log("Shutting down bot...");
  client.destroy();
  process.exit();
});
