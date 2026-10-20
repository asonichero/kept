import { storageReady, getJSON, setJSON, redis, readBody } from "./_lib.js";

// POST /api/sync — the app sends its reminder schedule, persona and today's progress.
// Body: { id, subscription?, tz, her, me, reminders:[{id,kind,time,taskId?,title?,essential?}], today:{date,done[],checkin,evening,burnout}, enabled }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!storageReady()) return res.status(503).json({ error: "storage" });
  const b = readBody(req);
  if (!b.id || !/^[a-z0-9]{8,40}$/i.test(b.id)) return res.status(400).json({ error: "id" });
  if (JSON.stringify(b).length > 20000) return res.status(413).json({ error: "too large" });
  const key = `kept:sub:${b.id}`;

  if (b.enabled === false) {
    await redis("DEL", key);
    await redis("SREM", "kept:subs", b.id);
    return res.status(200).json({ ok: true, removed: true });
  }

  const prev = (await getJSON(key)) || {};
  const subscription = b.subscription || prev.subscription;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "subscription" });
  if (!prev.subscription) {
    const n = await redis("SCARD", "kept:subs");
    if (n >= 20) return res.status(429).json({ error: "full" });
  }

  const rec = {
    subscription,
    tz: typeof b.tz === "string" ? b.tz.slice(0, 60) : "Europe/London",
    her: b.her || prev.her || {},
    me: b.me || prev.me || {},
    reminders: Array.isArray(b.reminders) ? b.reminders.slice(0, 40) : prev.reminders || [],
    today: b.today || prev.today || null,
    sent: prev.sent || {},
    updated: Date.now()
  };
  await setJSON(key, rec);
  await redis("SADD", "kept:subs", b.id);
  res.status(200).json({ ok: true });
}
