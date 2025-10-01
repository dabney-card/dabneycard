import { verifyJWT, passkitGetMember, passkitSetAttr, supa } from "./_lib.js";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const auth = verifyJWT(req);
  const { member_id, amount } = await req.json();

  const dollars = Math.max(0, Math.floor(Number(amount) || 0));
  if (!dollars) return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400 });

  const delta = dollars * Number(process.env.POINTS_PER_DOLLAR || 1);

  const m = await passkitGetMember(member_id);
  const cur = (m.customAttributes?.[auth.attribute_key] ?? 0);
  const next = cur + delta;

  await passkitSetAttr(member_id, auth.attribute_key, next);
  await supa.from("audit_logs").insert({
    vendor_id: auth.vendor_id,
    vendor_user_id: auth.vendor_user_id,
    member_id,
    action: "earn",
    points_delta: delta,
    metadata: { amount: dollars }
  });

  return new Response(JSON.stringify({ member_id, new_points: next }), { status: 200 });
}
