require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const cors = require("cors");
// ===== OPENAI (AI MODE) =====
// Ctrl+F: OPENAI
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // ✅ needed for prefix commands and reading chat
  ]
});

const CHANNEL_ID = process.env.CHANNEL_ID;

client.once("ready", () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
// ===== BOSS COMMANDS =====
const admin = require("firebase-admin");

let db = null;

try {
 const serviceAccount = require("./l9-boss-tracker-firebase-adminsdk-fbsvc-1d1ad6abf2.json"); // use your exact filename

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
  });

  db = admin.database();
  console.log("✅ Firebase admin ready");

} catch (err) {
  console.log("⚠️ Firebase not configured locally.");
}

function msToHuman(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}
// ===== COOLDOWN (anti-spam) =====
// Ctrl+F: COOLDOWN_MS

// ===== KNOWN BOSSES (for Not Set timers) =====
// Ctrl+F: KNOWN_BOSSES
const KNOWN_BOSSES = [
  "Viorent",
  "Ego",
  "Araneo",
  "Undomiel",
  "Lady Dalia",
  "General Aquleus",
  // add more whenever you want
];
const COOLDOWN_MS = 60_000;

// Ctrl+F: userCooldowns

// ===== AUTO DELETE BOT MESSAGES =====
// Ctrl+F: AUTO_DELETE_MS
const AUTO_DELETE_MS = 60_000; // 1 minute
const COOLDOWN_RULES = {
  next: 20_000,
  boss: 15_000,
  list: 60_000,
  ask: 10_000
};

// Ctrl+F: userCooldowns
const userCooldowns = new Map(); // key -> lastUsedTimestamp

setInterval(() => {
  const now = Date.now();
  for (const [key, lastUsed] of userCooldowns.entries()) {
    // delete after 10 minutes idle
    if (now - lastUsed > 10 * 60_000) userCooldowns.delete(key);
  }
}, 60_000);

async function sendTemp(channel, text) {
  const m = await channel.send(text);
  setTimeout(() => m.delete().catch(() => {}), AUTO_DELETE_MS);
  return m;
}

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // Only handle commands starting with !
  if (!msg.content.startsWith("!")) return;

  const [cmdRaw, ...rest] = msg.content.slice(1).trim().split(/\s+/);
  const cmd = (cmdRaw || "").toLowerCase();
  const arg = rest.join(" ").trim();

  // Commands we support
  // auto-delete the user's command message after 60s
const isBossCommand = ["next", "boss", "list", "ask"].includes(cmd);
if (!isBossCommand) return;

// auto-delete the user's command message after 60s
setTimeout(() => msg.delete().catch(() => {}), AUTO_DELETE_MS);

  // Cooldown (per user)
  // Cooldown (per user per command)
const nowTs = Date.now();

// make cooldown key unique per user+command
// Ctrl+F: COOLDOWN_KEY
const cooldownKey = `${msg.author.id}:${cmd}`;

const cmdCooldown = COOLDOWN_RULES[cmd] ?? 60_000; // fallback
const last = userCooldowns.get(cooldownKey) || 0;
const remainingCd = cmdCooldown - (nowTs - last);

if (remainingCd > 0) {
  const secs = Math.ceil(remainingCd / 1000);
  return sendTemp(
    msg.channel,
    `⏳ Slow down ${msg.author.username} — wait **${secs}s** before using **!${cmd}** again.`
  );
}

// set cooldown now (prevents spam even if Firebase errors)
userCooldowns.set(cooldownKey, nowTs);

  // Firebase check
  if (!db) return sendTemp(msg.channel,"⚠️ Firebase not configured on the bot.");

  try {
    const snap = await db.ref("bossTimers").get();
    const timers = snap.val() || {};

    const now = Date.now();

    // Helper: normalize boss data -> spawnMs
    const entries = Object.entries(timers)
      .map(([name, data]) => {
        const spawnMs = typeof data === "object" ? data.spawn : data;
        return { name, spawnMs };
      })
      .filter(x => x.spawnMs && x.spawnMs >= now)
      .sort((a, b) => a.spawnMs - b.spawnMs);

    // !next
    if (cmd === "next") {
      const soonest = entries[0];
      if (!soonest) return sendTemp(msg.channel,"No upcoming bosses.");
      const remaining = soonest.spawnMs - now;
      return sendTemp(msg.channel,`⚔️ **${soonest.name}** will spawn in **${msToHuman(remaining)}**`);
    }

    // !list  (next 5)
    if (cmd === "list") {
      if (entries.length === 0) return sendTemp(msg.channel,"No upcoming bosses.");

      const top = entries.slice(0, 5);
      const lines = top.map((b, i) => {
        const remaining = b.spawnMs - now;
        return `${i + 1}. ⚔️ **${b.name}** — **${msToHuman(remaining)}**`;
      });

      return sendTemp(msg.channel,`📌 **Next bosses:**\n${lines.join("\n")}`);
    }
// !ask <question>
// Ctrl+F: ASK_COMMAND
if (cmd === "ask") {
  if (!arg) return sendTemp(msg.channel, "Usage: `!ask <question>`");

  // cheap shortcut (so AI doesn't get called for obvious requests)
  const lower = arg.toLowerCase();
  // simple greetings (no AI call)
const greetings = ["hi","hello","hey","yo","sup","hola","goodmorning","good evening"];

// greeting only if the message is short
if (greetings.includes(lower) || greetings.includes(lower.replace(" bot",""))) {
  return sendTemp(
    msg.channel,
    `👋 Hello ${msg.author.username}! You can ask me about our **L9 boss timers**.`
  );
}
  if (lower.includes("next") || lower.includes("spawns next")) {
    const soonest = entries[0];
    if (!soonest) return sendTemp(msg.channel, "No upcoming bosses.");
    const remaining = soonest.spawnMs - now;
    return sendTemp(msg.channel, `⚔️ **${soonest.name}** will spawn in **${msToHuman(remaining)}**`);
  }
  if (lower.startsWith("list") || lower.includes("show list")) {
    if (entries.length === 0) return sendTemp(msg.channel, "No upcoming bosses.");
    const top = entries.slice(0, 5);
    const lines = top.map((b, i) => `${i + 1}. ⚔️ **${b.name}** — **${msToHuman(b.spawnMs - now)}**`);
    return sendTemp(msg.channel, `📌 **Next bosses:**\n${lines.join("\n")}`);
  }

  // Build small context for AI (keep it short)
  const top = entries.slice(0, 10).map(b => ({
    name: b.name,
    minutes: Math.round((b.spawnMs - now) / 60000),
  }));

  try {
    const resp = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a Discord bot for an MMORPG boss tracker. Be short. " +
            "If user asks about timers, use the provided data. If unknown, say you don't know.",
        },
        {
          role: "user",
          content: `Upcoming bosses (minutes from now): ${JSON.stringify(top)}\n\nUser: ${arg}`,
        },
      ],
    });

    const text = (resp.output_text || "").trim() || "I couldn't generate a reply.";
    return sendTemp(msg.channel, text);
  } catch (e) {
    console.error("❌ !ask AI error:", e);
    return sendTemp(
  msg.channel,
  "🤖 AI is temporarily unavailable. Try `!next`, `!list`, or `!boss <name>`."
);
  }
}
    // !boss <name>
    if (cmd === "boss") {
      if (!arg) return sendTemp(msg.channel,"Usage: `!boss <name>`");

      // Ctrl+F: BOSS_QUERY_NORMALIZE
const q = arg.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const found = Object.entries(timers).find(([name]) => {
  const cleaned = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  return cleaned.includes(q);
});

      // If not found in Firebase, check known list (means timer is Not Set)
// Ctrl+F: KNOWN_MATCH
const known = KNOWN_BOSSES.find(b =>
  b.toLowerCase().replace(/[^a-z0-9\s]/g, "").includes(q)
);

if (!found) {
  if (known) {
    return sendTemp(msg.channel,`⚠️ **${known}** timer is **Not Set** yet.`);
  }
  return sendTemp(msg.channel,`Boss not found: **${arg}**`);
}

      const [name, data] = found;
      const spawnMs = typeof data === "object" ? data.spawn : data;

      if (!spawnMs) return sendTemp(msg.channel,`No timer set for **${name}**.`);
      const remaining = spawnMs - now;

      if (remaining <= 0) return sendTemp(msg.channel,`🔥 **${name}** should be READY now.`);
      return sendTemp(msg.channel,`⚔️ **${name}** will spawn in **${msToHuman(remaining)}**`);
    }
  } catch (e) {
    console.error("❌ command error:", e);
    return sendTemp(msg.channel,"⚠️ Error reading Firebase timers.");
  }
});

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
