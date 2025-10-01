import jwt from "jsonwebtoken";

/** ---- utils ---- */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function verifyJWT(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"];
  if (!h) throw new Error("Missing Authorization header");
  const token = h.replace(/^Bearer\s+/i, "");
  return jwt.verify(token, process.env.JWT_SECRET);
}

async function passkitGetMember(memberId) {
  const url = `${process.env.PASSKIT_API_BASE}/membership/members/${encodeURIComponent(memberId)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.PASSKIT_API_KEY}` }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("PASSKIT GET ERROR:", resp.status, text);
    throw new Error(`PassKit GET failed (${resp.status})`);
  }
  return resp.json();
}

async function passkitSetAttr(memberId, attributeKey, value) {
  const url = `${process.env.PASSKIT_API_BASE}/membership/members/${encodeURIComponent(memberId)}`;
  const body = { customAttributes: { [attributeKey]: String(value) } };
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PASSKIT_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("PASSKIT PATCH ERROR:", resp.status, text, "BODY SENT:", body);
    throw new Error(`PassKit PATCH failed (${resp.status})`);
  }
  return resp.json();
}

/** ---- handler ---- */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const decoded = verifyJWT(req); // contains attribute_key, vendor_name, etc.
    const { memberId, amount } = await parseBody(req);

    console.log("EARN incoming:", { memberId, amount, vendor: decoded.vendor_name, attr: decoded.attribute_key });

    if (!memberId || amount === undefined || amount === null) {
      return res.status(400).json({ error: "memberId and amount required" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const attrKey = decoded.attribute_key || "meta.harrysMarket";

    // 1) Read current member
    const member = await passkitGetMember(memberId);

    // 2) Parse current points in this vendor channel
    const current = parseInt(member?.customAttributes?.[attrKey] ?? "0", 10) || 0;

    // 3) Compute earned
    const factor = parseInt(process.env.POINTS_PER_DOLLAR || "1", 10) || 1;
    const earned = Math.floor(amt * factor);
    const newPoints = current + earned;

    // 4) Update back to PassKit
    await passkitSetAttr(memberId, attrKey, newPoints);

    return res.status(200).json({
      success: true,
      vendor: decoded.vendor_name,
      memberId,
      earned,
      newPoints
    });
  } catch (err) {
    console.error("❌ /api/earn crash:", err);
    // Keep response generic, include status hint if our thrown message contains it
    const m = String(err.message || "");
    const hint = m.includes("PassKit") ? m : "Server error";
    return res.status(500).json({ error: hint });
  }
}
