import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const PASSKIT_BASE = process.env.PASSKIT_BASE!;
const PASSKIT_TOKEN = process.env.PASSKIT_TOKEN!;

const supaAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// Validate Supabase session sent as Bearer <access_token>
async function getUserFromAuthHeader(req: NextApiRequest) {
  const auth = req.headers.authorization?.split(' ');
  if (!auth || auth[0] !== 'Bearer' || !auth[1]) return null;
  const supa = createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supa.auth.getUser(auth[1]);
  if (error) return null;
  return data.user ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { memberId, delta } = req.body as { memberId: string; delta: number };
    if (!memberId || typeof delta !== 'number') {
      return res.status(400).json({ error: 'memberId and numeric delta required' });
    }

    // Map user -> vendor -> meta_field
    const { data: vu, error: vuErr } = await supaAdmin
      .from('vendor_users')
      .select('vendor_id, email, vendors:vendor_id(meta_field)')
      .eq('email', user.email)
      .single();

    if (vuErr || !vu) return res.status(403).json({ error: 'No vendor mapping' });

    const metaField = vu.vendors?.meta_field as string;
    if (!metaField) return res.status(500).json({ error: 'Vendor meta_field missing' });

    // GET PassKit member
    const getResp = await fetch(`${PASSKIT_BASE}/members/member/${memberId}`, {
      headers: { Authorization: `Bearer ${PASSKIT_TOKEN}`, 'Content-Type': 'application/json' }
    });
    if (!getResp.ok) {
      return res.status(502).json({ error: 'PassKit GET failed', detail: await getResp.text() });
    }
    const member = await getResp.json();

    // Resolve current value at metaField (e.g., meta.harrysMarket)
    const path = metaField.split('.');
    let cur: any = member;
    for (const key of path) cur = cur?.[key];
    const before = Number(cur ?? 0);
    const after = before + delta;
    if (!Number.isFinite(after) || after < 0) {
      return res.status(400).json({ error: 'Resulting value invalid (negative or non-numeric)' });
    }

    // Build minimal patch body
    const patchBody: any = {};
    let t = patchBody;
    path.forEach((k, i) => {
      if (i === path.length - 1) t[k] = after;
      else { t[k] = {}; t = t[k]; }
    });

    const patchResp = await fetch(`${PASSKIT_BASE}/members/member/${memberId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PASSKIT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    });
    if (!patchResp.ok) {
      return res.status(502).json({ error: 'PassKit PATCH failed', detail: await patchResp.text() });
    }

    // Audit (optional)
    await supaAdmin.from('audit_log').insert({
      vendor_id: vu.vendor_id,
      member_id: memberId,
      delta,
      before_value: before,
      after_value: after,
      actor_email: vu.email
    });

    return res.status(200).json({ ok: true, before, after });
  } catch (e: any) {
    return res.status(500).json({ error: 'Server error', detail: e?.message });
  }
}
