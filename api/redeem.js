import { verifyJWT, passkitGetMember, passkitSetAttr, supa } from "./_lib.js";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const auth = verifyJWT(req);
  const { member_id, reward } = await req.json();

  const need = reward === "12OFF" ? 100 : 50;
  const m = await passkitGetMember(member_id);
  const cur = (m.customAttributes?.[auth.attribute_key] ?? 0);
  if (cur < need) return new Response(JSON.stringify({ error: "Not enough points" }), { status: 400 });

  const next = cur - need;
  await passkitSetAttr(member_id, auth.attribute_key, next);
  const redemption_code = Math.random().toString(36).slice(2,8).toUpperCase();

  await supa.from("audit_logs").insert({
    vendor_id: auth.vendor_id,
    vendor_user_id: auth.vendor_user_id,
    member_id,
    action: "redeem",
    points_delta: -need,
    metadata: { reward, redemption_code }
  });

  return new Response(JSON.stringify({ member_id, new_points: next, redemption_code }), { status: 200 });
}
