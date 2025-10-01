// /pages/api/earn.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getPasskitToken, passkitFetch, requireVendorUser, getVendorPermissions, clampChanges } from "../../server/lib";

type Change = { field: string; delta: number }; // e.g., { field: "meta.harrysMarket.food", delta: 25 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireVendorUser(req, res);
  const { memberId, changes } = req.body as { memberId: string; changes: Change[] };
  if (!memberId || !Array.isArray(changes)) return res.status(400).json({ error: "memberId and changes[] required" });

  const perms = await getVendorPermissions(user.vendor_id);
  const safeChanges = clampChanges(changes, perms); // enforce allowed prefixes & caps

  const token = await getPasskitToken();
  const member = await passkitFetch(`/members/member/${memberId}`, { token });

  // Apply deltas to current meta
  const newMeta = { ...(member.meta ?? {}) };
  for (const { field, delta } of safeChanges) {
    const path = field.replace(/^meta\./, "").split(".");
    let cursor: any = newMeta;
    for (let i = 0; i < path.length - 1; i++) {
      cursor[path[i]] = cursor[path[i]] ?? {};
      cursor = cursor[path[i]];
    }
    const leaf = path[path.length - 1];
    const current = Number(cursor[leaf] ?? 0);
    const next = current + Number(delta);
    cursor[leaf] = next < 0 ? 0 : next; // no negatives by default
  }

  // Push update to PassKit
  const updated = await passkitFetch(`/members/member/${memberId}`, {
    token,
    method: "PUT",
    body: { meta: newMeta },
  });

  // Audit
  // await insertAudit({ user_id: user.id, memberId, action: "earn", changes: safeChanges, before: member.meta, after: newMeta });

  return res.json({ ok: true, meta: updated.meta });
}
