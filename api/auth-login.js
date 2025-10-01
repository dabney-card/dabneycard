import bcrypt from "bcryptjs";
import { supa, signJWT } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Fetch user
    const { data: user, error: userErr } = await supa
      .from("vendor_users")
      .select("id,email,password_hash,role,vendor_id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (userErr) {
      console.error("Supabase error (vendor_users):", userErr);
      return res.status(500).json({ error: "Auth query failed" });
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid login" });
    }

    // Check password
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid login" });
    }

    // Fetch vendor
    const { data: vendor, error: vendorErr } = await supa
      .from("vendors")
      .select("id,name,attribute_key")
      .eq("id", user.vendor_id)
      .limit(1)
      .maybeSingle();

    if (vendorErr) {
      console.error("Supabase error (vendors):", vendorErr);
      return res.status(500).json({ error: "Vendor lookup failed" });
    }
    if (!vendor) {
      return res.status(400).json({ error: "Vendor not found" });
    }

    // Create JWT
    const token = signJWT({
      vendor_user_id: user.id,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      attribute_key: vendor.attribute_key,
      role: user.role
    });

    return res.status(200).json({
      token,
      vendor: { id: vendor.id, name: vendor.name }
    });
  } catch (err) {
    console.error("auth-login fatal error:", err);
    return res.status(500).json({ error: "Server error: auth-login failed" });
  }
}
