import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse raw body
    let body = '';
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', resolve);
      req.on('error', reject);
    });

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      console.error('❌ Invalid JSON:', body);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { email, password } = parsed;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('🔎 Looking up user:', email);

    // Fetch from Supabase
    const { data: users, error } = await supabase
      .from('vendor_users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!users || users.length === 0) {
      console.log('❌ No user found for:', email);
      return res.status(401).json({ error: 'Invalid login' });
    }

    const user = users[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      console.log('❌ Wrong password for:', email);
      return res.status(401).json({ error: 'Invalid login: wrong password' });
    }

    // Issue JWT
    const token = jwt.sign(
      {
        vendor_user_id: user.id,
        vendor_id: user.vendor_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    console.log('✅ Login success for:', email);

    return res.status(200).json({
      token,
      vendor: {
        id: user.vendor_id,
        name: user.vendor_name || 'Vendor',
      },
    });
  } catch (err) {
    console.error('❌ Auth handler crash:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
