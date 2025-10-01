import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = await parseBody(req);

    const { data: users, error } = await supabase
      .from('vendor_users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid login' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid login: wrong password' });
    }

    const token = jwt.sign(
      {
        vendor_user_id: user.id,
        vendor_id: user.vendor_id,
        vendor_name: user.vendor_name || "Vendor",
        attribute_key: user.attribute_key || "meta.harrysMarket",
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      token,
      vendor: { id: user.vendor_id, name: user.vendor_name || "Vendor" }
    });
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
