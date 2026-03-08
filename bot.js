require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  MessageFlags
} = require("discord.js");
const express = require("express");
const cors = require("cors");
// ===== OPENAI (AI MODE) =====
// ===== GROQ AI =====
// Ctrl+F: GROQ
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

const OPENAI_MODEL = "llama-3.3-70b-versatile";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_ID = process.env.CHANNEL_ID;
const OWNER_ID = "709437629199941685";
const CLIENT_ID = process.env.CLIENT_ID; 
const GUILD_IDS = (process.env.GUILD_IDS || process.env.GUILD_ID || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

const slashCommands = [
  new SlashCommandBuilder()
    .setName("speak")
    .setDescription("Make the bot speak publicly")
    .addStringOption(option =>
      option
        .setName("text")
        .setDescription("What the bot should say")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("replyto")
        .setDescription("Message ID to reply to")
        .setRequired(false)
    )
    .toJSON()
];

client.once("clientReady", async () => {
  console.log(`✅ Bot online as ${client.user.tag} | PID: ${process.pid}`);

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    for (const guildId of GUILD_IDS) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guildId.trim()),
        { body: slashCommands }
      );

      console.log(`✅ Slash commands registered in guild ${guildId}`);
    }

  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
// ===== BOSS COMMANDS =====
const admin = require("firebase-admin");

let db = null;

try {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Railway / production
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // Local PC
    serviceAccount = require("./l9-boss-tracker-firebase-adminsdk-fbsvc-1d1ad6abf2.json");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
  });

  db = admin.database();
  console.log("✅ Firebase admin ready");
} catch (err) {
  console.error("⚠️ Firebase not configured:", err.message);
}

function msToHuman(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}
function getNextFixedSpawn(schedule) {
  const now = new Date();

  // convert "now" into Philippines time by shifting +8h from UTC
  const nowPH = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  let soonest = null;

  for (const s of schedule) {
    const [hour, minute] = s.time.split(":").map(Number);

    // build target in PH time first
    const targetPH = new Date(nowPH);
    targetPH.setUTCHours(hour, minute, 0, 0);

    const dayDiff = (s.day - targetPH.getUTCDay() + 7) % 7;
    targetPH.setUTCDate(targetPH.getUTCDate() + dayDiff);

    if (targetPH <= nowPH) {
      targetPH.setUTCDate(targetPH.getUTCDate() + 7);
    }

    // convert back to real UTC timestamp
    const targetUTC = new Date(targetPH.getTime() - 8 * 60 * 60 * 1000);

    if (!soonest || targetUTC < soonest) {
      soonest = targetUTC;
    }
  }

  return soonest;
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
// ===== FIXED BOSSES FROM WEBSITE =====
const FIXED_BOSSES = [
{ name:"Clemantis", schedule:[{day:1,time:"11:30"},{day:4,time:"19:00"}], disabled:true },
{ name:"Saphirus", schedule:[{day:0,time:"17:00"},{day:2,time:"11:30"}], disabled:true },
{ name:"Neutro", schedule:[{day:2,time:"19:00"},{day:4,time:"11:30"}], disabled:true },
{ name:"Thymele", schedule:[{day:1,time:"19:00"},{day:3,time:"11:30"}], disabled:true },

{ name:"Milavy", schedule:[{day:6,time:"15:00"}] },
{ name:"Ringor", schedule:[{day:6,time:"17:00"}] },
{ name:"Roderick", schedule:[{day:5,time:"19:00"}] },
{ name:"Auraq", schedule:[{day:5,time:"22:00"},{day:3,time:"21:00"}] },
{ name:"Chaiflock", schedule:[{day:6,time:"22:00"}] },
{ name:"Benji", schedule:[{day:0,time:"21:00"}] },

{ name:"Libitina", schedule:[{day:1,time:"21:00"},{day:6,time:"21:00"}] },

{ name:"Rakajeth", schedule:[{day:2,time:"22:00"},{day:0,time:"19:00"}] },

{ name:"Icaruthia", schedule:[{day:2,time:"21:00"},{day:5,time:"21:00"}], disabled:true },
{ name:"Motti", schedule:[{day:3,time:"19:00"},{day:6,time:"19:00"}], disabled:true },
{ name:"Nevaeh", schedule:[{day:0,time:"22:00"}], disabled:true },

{ name:"Tumier", schedule:[{day:0,time:"19:00"}] }
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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  // !say hello guys
  if (command === "say") {
    if (message.author.id !== OWNER_ID) {
      return message.reply("nope only my owner can use this command 😎");
    }

    const text = args.join(" ").trim();
    if (!text) {
      return message.reply("type something like `!say hello guild`");
    }

    // Optional: delete your command message so only bot message stays
    try {
      await message.delete();
    } catch (err) {
      console.log("Could not delete command message:", err.message);
    }

    await message.channel.send(text);
  }
});



client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "speak") {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "only my owner can use this 😎",
        flags: MessageFlags.Ephemeral
      });
    }

    const text = interaction.options.getString("text", true);
    const replyTo = interaction.options.getString("replyto");

    await interaction.reply({
      content: "sent 👌",
      flags: MessageFlags.Ephemeral
    });

    if (replyTo) {
      try {
        const msg = await interaction.channel.messages.fetch(replyTo);

        await msg.reply({
          content: text,
          allowedMentions: { repliedUser: false }
        });
      } catch (err) {
        console.log("Could not reply to target message:", err.message);
        await interaction.channel.send(text);
      }
    } else {
      await interaction.channel.send(text);
    }
  }
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // Only handle commands starting with !
  if (!msg.content.startsWith("!")) return;

  const [cmdRaw, ...rest] = msg.content.slice(1).trim().split(/\s+/);
  const cmd = (cmdRaw || "").toLowerCase();
  const arg = rest.join(" ").trim();

  // Commands we support
  // auto-delete the user's command message after 60s
const supportedCommands = ["next", "boss", "list", "ask"].includes(cmd);
if (!supportedCommands) return;

// auto-delete the user's command message after 60s
if (cmd !== "ask") {
  setTimeout(() => msg.delete().catch(() => {}), AUTO_DELETE_MS);
}

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

const fixedSnap = await db.ref("fixedBossGuilds").get();
const fixedGuilds = fixedSnap.val() || {};

    const now = Date.now();

    // Helper: normalize boss data -> spawnMs
    // interval bosses from Firebase
const intervalEntries = Object.entries(timers)
  .map(([name, data]) => {
    const spawnMs = typeof data === "object" ? data.spawn : data;
    return { name, spawnMs, type: "interval" };
  })
  .filter(x => x.spawnMs && x.spawnMs >= now);

// fixed bosses from schedule (skip disabled)
const fixedEntries = FIXED_BOSSES
  .filter(b => {
    const entry = fixedGuilds[b.name];

    // website/firebase disabled check
    if (entry === "Disabled") return false;
    if (entry && typeof entry === "object" && entry.disabled === true) return false;

    // local hardcoded fallback
    if (b.disabled) return false;

    return true;
  })
  .map(b => {
    const nextSpawn = getNextFixedSpawn(b.schedule);
    return {
      name: b.name,
      spawnMs: nextSpawn ? nextSpawn.getTime() : null,
      type: "fixed"
    };
  })
  .filter(x => x.spawnMs && x.spawnMs >= now);

// merge both
const entries = [...intervalEntries, ...fixedEntries]
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
  console.log(`!ask used by ${msg.author.tag} | arg: ${arg} | PID: ${process.pid}`);
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
   const resp = await openai.chat.completions.create({
  model: OPENAI_MODEL,
  messages: [
    {
      role: "system",
      content:
        "You are a funny Discord guild bot for an MMORPG boss tracker. Be short and natural."
    },
    {
      role: "user",
      content: `Upcoming bosses (minutes from now): ${JSON.stringify(top)}\n\nUser: ${arg}`
    }
  ]
});

const text =
  resp.choices?.[0]?.message?.content?.trim() ||
  "I couldn't generate a reply.";
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
