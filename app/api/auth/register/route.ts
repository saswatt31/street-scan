import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/db';
import { ok, created, badRequest, serverError } from '@/lib/middleware/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, role = 'citizen', phone } = await req.json();

    if (!email || !password) return badRequest('email and password are required');
    if (password.length < 8)  return badRequest('Password must be at least 8 characters');

    const allowed = ['citizen', 'repair_team'];
    if (!allowed.includes(role)) return badRequest('Invalid role. Self-registration allows: citizen, repair_team');

    const sb = getServiceClient();

    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // skip email confirmation for local dev
      user_metadata: { full_name, role, phone },
    });

    if (error) {
      if (error.message.includes('already registered')) return badRequest('Email already in use');
      throw error;
    }

    // Profile is auto-created by the DB trigger (handle_new_user)
    // Update phone if provided
    if (phone && data.user) {
      await sb.from('users').update({ phone }).eq('id', data.user.id);
    }

    return created({ message: 'Account created. You may now log in.' });
  } catch (e) {
    return serverError(e);
  }
}
