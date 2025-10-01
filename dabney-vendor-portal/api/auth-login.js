import bcrypt from "bcryptjs";
import { supa, signJWT } from "./_lib.js";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { email, password } = await req.json();

  const { data: user, error } = await supa
    .from("vendor_users")
    .select("id,email,password_hash,role,vendor_id, vendors:vendor_id ( id,name,attribute_key )")
    .eq("email", email)
    .single();

  if (error || !user) return new Response(JSON.stringify({ error: "Invalid login" }), { status: 401 });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return new Response(JSON.stringify({ error: "Invalid login" }), { status: 401 });

  const token = signJWT({
    vendor_user_id: user.id,
    vendor_id: user.vendors.id,
    vendor_name: user.vendors.name,
    attribute_key: user.vendors.attribute_key,
    role: user.role
  });
  return new Response(JSON.stringify({ token, vendor: { id: user.vendors.id, name: user.vendors.name } }), { status: 200 });
}
