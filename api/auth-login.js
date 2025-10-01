import bcrypt from "bcryptjs";
import { supa, signJWT } from "./_lib.js";

// Optional: set DEV_MASTER_PASSWORD in Vercel env to bypass bcrypt while debugging.
// NEVER leave it set in production long-term.
const MASTER = process.env.DEV_MASTER_PASSWORD || "";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    // Fetch user
    const { data: user, error: userErr } = await supa
      .from("vendor_users")
      .select("id,email,password_hash,role,vendor_id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    console.log("AUTHv3 USER:", !!user, userErr || null, email);

    if (userErr) return res.status(500).json({ error: "Auth query failed" });
    if (!user) return res.status(401).json({ error: "Invalid login: no such user" });

    // TEMP dev bypass if you set DEV_MASTER_PASSWORD in Vercel env
    if (MASTER && password === MASTER) {
      console.warn("AUTHv3 MASTER PASSWORD USED for", email);
    } else {
      // bcrypt compare
      console.log("AUTHv3 HASH LEN:", user.password_hash?.length, "PREFIX:", user.password_hash?.slice(0, 4));
      const ok = await bcrypt.compare(password, user.password_hash || "");
      console.log("AUTHv3 COMPARE:", ok);
      if (!ok) return res.status(401).json({ error: "Invalid login: wrong password" });
    }

    // Fetch vendor
    const { data: vendor, error: vendorErr } = await supa
      .from("vendors")
      .select("id,name,attribute_key")
      .eq("id", user.vendor_id)
      .limit(1)
      .maybeSingle();

    console.log("AUTHv3 VENDOR:", !!vendor, vendorErr || null);

    if (vendorErr) return res.status(500).json({ error: "Vendor lookup failed" });
    if (!vendor) return res.status(400).json({ error: "Vendor not found" });

    const token = signJWT({
      vendor_user_id: user.id,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      attribute_key: vendor.attribute_key,
      role: user.role
    });

    return res.status(200).json({ token, vendor: { id: vendor.id, name: vendor.name } });
  } catch (err) {
    console.error("AUTHv3 FATAL:", err);
    return res.status(500).json({ error: "Server error: auth-login failed" });
  }
}
