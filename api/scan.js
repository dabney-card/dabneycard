import { verifyJWT, passkitGetMember } from "./_lib.js";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const auth = verifyJWT(req);
  const { member_id } = await req.json();
  const m = await passkitGetMember(member_id);
  const points = (m.customAttributes?.[auth.attribute_key] ?? 0);
  const eligible = { fivePct: points >= 50, twelvePct: points >= 100 };
  return new Response(JSON.stringify({ member_id, points, eligible }), { status: 200 });
}
