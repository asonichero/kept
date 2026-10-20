import { storageReady, getJSON, send, line, readBody } from "./_lib.js";

// POST /api/test { id } — sends one notification straight away so you can hear her.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!storageReady()) return res.status(503).json({ error: "storage" });
  const { id } = readBody(req);
  const rec = id && (await getJSON(`kept:sub:${id}`));
  if (!rec) return res.status(404).json({ error: "not subscribed" });
  try {
    await send(rec.subscription, { title: rec.her?.name || "Kept", body: line(rec, "test"), tag: "kept-test" }, req.headers.host);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.statusCode || String(e.message || e) });
  }
}
