import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

export const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export function signJWT(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h" });
}
export function verifyJWT(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("no token");
  return jwt.verify(h.slice(7), process.env.JWT_SECRET);
}

export async function passkitGetMember(memberId) {
  const r = await fetch(`${process.env.PASSKIT_API_BASE}/members/${memberId}`, {
    headers: { Authorization: `Bearer ${process.env.PASSKIT_API_KEY}` }
  });
  if (!r.ok) throw new Error("member not found");
  return r.json();
}
export async function passkitSetAttr(memberId, key, value) {
  const r = await fetch(`${process.env.PASSKIT_API_BASE}/members/${memberId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PASSKIT_API_KEY}`
    },
    body: JSON.stringify({ customAttributes: { [key]: value } })
  });
  if (!r.ok) throw new Error("update failed");
}
