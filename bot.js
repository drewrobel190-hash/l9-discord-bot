require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const cors = require("cors");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const CHANNEL_ID = process.env.CHANNEL_ID;

client.once("clientReady", () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.use(cors());
app.use(express.json());

app.post("/alert", async (req, res) => {
  try {
    const message = req.body.message;

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (channel) {
      await channel.send(message);
      console.log("📨 Sent:", message);
    }

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