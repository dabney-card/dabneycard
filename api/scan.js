import jwt from "jsonwebtoken";

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function verifyJWT(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing Authorization header");
  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, process.env.JWT_SECRET);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const decoded = verifyJWT(req);
    const body = await parseBody(req);

    console.log("SCAN payload:", decoded);

    return res.status(200).json({
      ok: true,
      vendor: decoded.vendor_name,
      vendor_id: decoded.vendor_id,
      data: body
    });
  } catch (err) {
    console.error("❌ Scan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
