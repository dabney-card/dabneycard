import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse JSON body manually
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', resolve);
    });
    const { email, password } = JSON.parse(body);

    // Lookup vendor user
    const { data: users, error } = await supabase
      .from('vendor_users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid login' });
    }

    const user = users[0];

    // Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid login: wrong password' });
    }

    // Create JWT
    const token = jwt.sign(
      {
        vendor_user_id: user.id,
        vendor_id: user.vendor_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      token,
      vendor: { id: user.vendor_id, name: user.vendor_name || 'Vendor' },
    });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
