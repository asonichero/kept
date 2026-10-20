import webpush from "web-push";

// ---------- Redis (Upstash REST) ----------
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function storageReady() { return Boolean(RURL && RTOK); }

export async function redis(...cmd) {
  const r = await fetch(RURL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RTOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
export async function getJSON(key) { const v = await redis("GET", key); return v ? JSON.parse(v) : null; }
export async function setJSON(key, val) { return redis("SET", key, JSON.stringify(val)); }

// ---------- VAPID keys: generated once and kept in Redis ----------
let vapidCache = null;
export async function vapid() {
  if (vapidCache) return vapidCache;
  let v = await getJSON("kept:vapid");
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    await redis("SET", "kept:vapid", JSON.stringify(k), "NX");
    v = await getJSON("kept:vapid");
  }
  return (vapidCache = v);
}

export async function send(subscription, payload, host) {
  const v = await vapid();
  webpush.setVapidDetails(`https://${host || "kept.vercel.app"}`, v.publicKey, v.privateKey);
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
}

// ---------- time in the user's zone ----------
export function nowIn(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, mins: Number(parts.hour) * 60 + Number(parts.minute) };
}
export const toMins = t => { const [h, m] = String(t || "").split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

// ---------- her voice for notifications ----------
const LINES = {
  gentle: {
    checkin: ["Morning, {pet}. Come and tell me how you are.", "No rush, {pet}. Check in with me when you're ready."],
    evening: ["Come and tell me about your day, {pet}.", "Time to wind down. Give me your report, {pet}."],
    task: ["Gentle reminder, {pet}: {task}. Just that one thing.", "{task}, please. Then you can stop thinking about it."],
    follow: ["Still here, {pet}. {task} when you can.", "Not cross. Just reminding you: {task}."],
    test: ["There you are, {pet}. I can reach you now."]
  },
  firm: {
    checkin: ["Check in with me, {pet}. Now, please.", "Morning report, {pet}. I'm waiting."],
    evening: ["Evening report time. Come and account for your day.", "Bedtime's coming, {pet}. Report in."],
    task: ["{task}. I'm expecting it done, {pet}.", "Time for {task}. Go on."],
    follow: ["I asked once already. {task}, {pet}.", "Still not done? {task}. Now."],
    test: ["Good. Now I can reach you whenever I like, {pet}."]
  },
  strict: {
    checkin: ["Report. You haven't checked in.", "Up and report, {pet}. Now."],
    evening: ["Evening report. I'm waiting.", "Account for your day, {pet}. Now."],
    task: ["{task}. Now.", "{task}, {pet}. Don't make me wait."],
    follow: ["Twice now, {pet}. {task}. Don't make me ask again.", "I noticed. {task}. Immediately."],
    test: ["Good {term}. You'll answer when I call now."]
  }
};
export function line(rec, kind, task) {
  const burnout = rec.today && rec.today.burnout;
  const i = rec.her?.intensity || 3;
  const b = burnout ? "gentle" : i <= 2 ? "gentle" : i === 3 ? "firm" : "strict";
  const arr = LINES[b][kind];
  const s = arr[Math.floor(Math.random() * arr.length)];
  return s.replace(/\{pet\}/g, rec.her?.pet || "pet").replace(/\{term\}/g, rec.me?.term || "pet").replace(/\{task\}/g, task || "");
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
