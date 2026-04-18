'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Loader2, HardHat } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize Supabase Client natively as requested
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter both email and password.'); return; }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();
      
      const userRole = profile?.role || 'citizen';
      toast.success('Login successful! Redirecting...');

      // Crucial 1-second delay so browser sets the sb-xxx-auth-token flawlessly!
      setTimeout(() => {
        if (userRole === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (userRole === 'repair_team') {
          window.location.href = '/worker/dashboard';
        } else {
          toast.error(`Access Denied: You are mapped as: ${userRole}`);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Login error:', error.message);
      toast.error(error.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[url('/grid.svg')] bg-center relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1115]/90 via-[#0F1115]/95 to-black z-0 pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        
        {/* Branding header */}
        <div className="flex justify-center text-blue-500 mb-6">
          <HardHat size={48} strokeWidth={1.5} />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
          Employee Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400 font-medium">
          Sign in to access your worker queue or admin dashboard.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#1A1D24]/80 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white/5 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Employee Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 bg-black/40 border-white/10 border text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-3"
                  placeholder="name@streetscan.gov"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 bg-black/40 border-white/10 border text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-3"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-[#1A1D24] transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <div className="flex items-center gap-2">
                    Sign in <ArrowRight size={18} />
                  </div>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <div className="text-sm">
              <Link href="/" className="font-medium text-gray-400 hover:text-white transition-colors">
                ← Return to Public Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
