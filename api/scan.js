import { verifyJWT } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Verify token
    const payload = verifyJWT(req);
    console.log("SCAN payload:", payload);

    // Example: respond with the payload and any body data
    return res.status(200).json({
      ok: true,
      vendor: payload.vendor_name,
      data: req.body || {}
    });
  } catch (err) {
    console.error("SCAN error:", err);
    return res.status(401).json({ error: "Invalid or missing token" });
  }
}
