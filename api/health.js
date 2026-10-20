import { storageReady, redis } from "./_lib.js";

// GET /api/health -> whether reminder storage is connected and reachable
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!storageReady()) return res.status(200).json({ storage: "missing" });
  try {
    const subs = await redis("SCARD", "kept:subs");
    res.status(200).json({ storage: "ok", subscribers: subs });
  } catch (e) {
    res.status(200).json({ storage: "error", message: String(e.message || e) });
  }
}
