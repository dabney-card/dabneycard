// /pages/api/scan.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getPasskitToken, passkitFetch, requireVendorUser } from "../../server/lib";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireVendorUser(req, res); // your session auth
  const { memberId } = req.query;
  if (!memberId || typeof memberId !== "string") return res.status(400).json({ error: "memberId required" });

  const token = await getPasskitToken(); // long-lived or refreshed
  const member = await passkitFetch(`/members/member/${memberId}`, { token });

  // Optional: enforce vendor permissions here (e.g., which meta fields they can view)
  return res.json({
    memberId: memberId,
    name: member.person?.displayName ?? "",
    meta: member.meta ?? {},
  });
}
