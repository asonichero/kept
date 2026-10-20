import { storageReady, vapid } from "./_lib.js";

// GET /api/key -> the public key the app needs to subscribe to push
export default async function handler(req, res) {
  if (!storageReady()) return res.status(503).json({ error: "storage", message: "Reminder storage isn't connected yet. Add Upstash Redis to the Vercel project." });
  try {
    const v = await vapid();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ publicKey: v.publicKey });
  } catch (e) {
    res.status(500).json({ error: "vapid", message: String(e.message || e) });
  }
}
