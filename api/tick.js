import { storageReady, getJSON, setJSON, redis, send, nowIn, toMins, line } from "./_lib.js";

// GET /api/tick — called every ~10 minutes by the GitHub Action.
// Sends any reminder that is due and not yet satisfied. Safe to call repeatedly:
// each reminder fires at most once (plus one follow-up) per day.
const WINDOW = 120;      // minutes after the set time that a reminder can still fire
const FOLLOW_AFTER = 60; // minutes before a follow-up nudge

export default async function handler(req, res) {
  if (!storageReady()) return res.status(503).json({ error: "storage" });
  const ids = (await redis("SMEMBERS", "kept:subs")) || [];
  const report = [];

  for (const id of ids) {
    const key = `kept:sub:${id}`;
    const rec = await getJSON(key);
    if (!rec) { await redis("SREM", "kept:subs", id); continue; }

    const now = nowIn(rec.tz);
    const today = rec.today && rec.today.date === now.date ? rec.today : { date: now.date, done: [], checkin: false, evening: false, burnout: false };
    const view = { ...rec, today };
    const followUps = (rec.her?.intensity || 3) >= 3 && !today.burnout;
    let changed = false, gone = false;

    for (const r of rec.reminders || []) {
      const t = toMins(r.time);
      if (t === null) continue;
      if (r.kind === "task" && today.burnout && !r.essential) continue;

      const satisfied = r.kind === "checkin" ? today.checkin
        : r.kind === "evening" ? today.evening
        : (today.done || []).includes(r.taskId);
      if (satisfied) continue;

      const s = rec.sent[r.id] && rec.sent[r.id].date === now.date ? rec.sent[r.id] : { date: now.date, count: 0 };
      const first = s.count === 0 && now.mins >= t && now.mins < t + WINDOW;
      const lastAt = s.at ?? t;
      const follow = followUps && s.count === 1 && now.mins >= lastAt + FOLLOW_AFTER && now.mins < lastAt + FOLLOW_AFTER + WINDOW;
      if (!first && !follow) continue;

      const kind = follow ? "follow" : r.kind;
      const body = line(view, kind, r.title);
      try {
        await send(rec.subscription, { title: rec.her?.name || "Kept", body, tag: `kept-${r.id}` }, req.headers.host);
        rec.sent[r.id] = { date: now.date, count: s.count + 1, at: now.mins };
        changed = true;
        report.push({ id, reminder: r.id, kind });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { gone = true; break; }
        report.push({ id, reminder: r.id, error: e.statusCode || String(e.message || e) });
      }
    }

    if (gone) { await redis("DEL", key); await redis("SREM", "kept:subs", id); }
    else if (changed) await setJSON(key, rec);
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, checked: ids.length, sent: report });
}
