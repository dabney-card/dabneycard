import jwt from "jsonwebtoken";

// Utility: parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

// Utility: verify JWT
function verifyJWT(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing Authorization header");
  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Utility: fetch member from PassKit
async function passkitGetMember(memberId) {
  const resp = await fetch(
    `${process.env.PASSKIT_API_BASE}/membership/members/${memberId}`,
    {
      headers: { Authorization: `Bearer ${process.env.PASSKIT_API_KEY}` },
    }
  );
  if (!resp.ok) {
    throw new Error(`PassKit GET failed: ${resp.status}`);
  }
  return resp.json();
}

// Utility: update attribute in PassKit
async function passkitSetAttr(memberId, attributeKey, value) {
  const resp = await fetch(
    `${process.env.PASSKIT_API_BASE}/membership/members/${memberId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PASSKIT_API_KEY}`,
      },
      body: JSON.stringify({
        customAttributes: { [attributeKey]: String(value) },
      }),
    }
  );
  if (!resp.ok) {
    throw new Error(`PassKit PATCH failed: ${resp.status}`);
  }
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const decoded = verifyJWT(req);
    const { memberId, amount } = await parseBody(req);

    if (!memberId || !amount) {
      return res.status(400).json({ error: "memberId and amount required" });
    }

    console.log("🪙 Earn request", { vendor: decoded.vendor_name, memberId, amount });

    // Get member's current points
    const member = await passkitGetMember(memberId);
    const current = parseInt(
      member.customAttributes?.[decoded.attribute_key] || "0",
      10
    );

    const earned = Math.floor(
      amount * parseInt(process.env.POINTS_PER_DOLLAR || "1", 10)
    );
    const newPoints = current + earned;

    // Update member points
    await passkitSetAttr(memberId, decoded.attribute_key, newPoints);

    return res.status(200).json({ success: true, newPoints });
  } catch (err) {
    console.error("❌ Earn error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
