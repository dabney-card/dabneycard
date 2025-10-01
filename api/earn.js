import jwt from "jsonwebtoken";

// ---- utils ----
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (err) { reject(new Error("Invalid JSON body")); }
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
    const txt = await resp.text();
    throw new Error(`PassKit GET ${resp.status}: ${txt}`);
  }
  return resp.json();
}

async function passkitSetAttr(memberId, attributeKey, value) {
  const url = `${process.env.PASSKIT_API_BASE}/membership/members/${encodeURIComponent(memberId)}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PASSKIT_API_KEY}`
    },
    body: JSON.stringify({ customAttributes: { [attributeKey]: String(value) } })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`PassKit PATCH ${resp.status}: ${txt}`);
  }
  return resp.json();
}

// ---- handler ----
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const decoded = verifyJWT(req); // { vendor_id, vendor_name, attribute_key, ... }
    const body = await parseBody(req);
    const memberId = body?.memberId;
    const amountRaw = body?.amount;

    // Basic validation + logging to help you debug the frontend request
    console.log("EARN incoming body:", body);
    if (!memberId || amountRaw === undefined || amountRaw === null) {
      return res.status(400).json({ error: "memberId and amount required" });
    }

    // Force number; reject NaN/negative
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // Read current points from the vendor-specific attribute on the member
    const member = await passkitGetMember(memberId);
    const attrKey = decoded.attribute_key || "meta.harrysMarket";
    const current = parseInt(member?.customAttributes?.[attrKey] ?? "0", 10) || 0;

    // Points math
    const factor = parseInt(process.env.POINTS_PER_DOLLAR || "1", 10) || 1;
    const earned = Math.floor(amount * factor);
    const newPoints = current + earned;

    // Write back to PassKit
    await passkitSetAttr(memberId, attrKey, newPoints);

    // Done
    return res.status(200).json({
      success: true,
      vendor: decoded.vendor_name,
      memberId,
      earned,
      newPoints
    });
  } catch (err) {
    console.error("❌ /api/earn error:", err);
    // Keep response concise but useful
    return res.status(500).json({ error: "Server error" });
  }
}
