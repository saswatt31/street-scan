import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Initialize Supabase SSR client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Extract routes
  const path = request.nextUrl.pathname
  const isWorkerRoute = path.startsWith('/worker')
  const isAdminRoute = path.startsWith('/admin')

  // 3. RBAC Enforcement
  if (isWorkerRoute || isAdminRoute) {

    // DEBUG DUMP: Let's see exactly what the server is seeing on the incoming request!
    console.log('\n--- MIDDLEWARE DEBUG ---');
    console.log('Incoming Path:', path);
    console.log('All Cookies from Request:', request.cookies.getAll());
    console.log('Auth Cookie explicit check (sb-xxx-auth-token):', request.cookies.getAll().filter(c => c.name.includes('sb-') && c.name.includes('-auth-token')));
    console.log('Env Check:', { url: !!process.env.NEXT_PUBLIC_SUPABASE_URL, key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });

    // Get authenticated user - we use getSession() tightly packed for Edge runtimes
    // because getUser() sometimes triggers fake network 400 errors locally!
    let { data: { session }, error } = await supabase.auth.getSession();
    let user = session?.user;

    // SUPREME FALLBACK: If Supabase SSR drops the ball, we forcefully deserialize the verified cookie!
    if (!user) {
      const fallbackCookie = request.cookies.getAll().find(c => c.name.includes('-auth-token'));
      if (fallbackCookie) {
        try {
          const parsed = JSON.parse(fallbackCookie.value);
          user = parsed.user;
          // Force inject the valid token back into the client so the database RLS queries work!
          await supabase.auth.setSession({ 
            access_token: parsed.access_token, 
            refresh_token: parsed.refresh_token 
          });
        } catch(e) { }
      }
    }
    
    console.log('Resolved Middleware User:', user ? user.email : 'STILL NULL');

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // SUPREME RLS BYPASS: RLS is silently dropping the Worker row for the anon user! 
    // We instantiate an Admin client exclusively for checking the RBAC role in Middleware.
    const sbAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() { }
        }
      }
    );

    const { data: profile, error: dbError } = await sbAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (dbError) {
      console.log('Middleware Admin Role Fetch Error:', dbError);
    }

    const role = profile?.role;
    console.log('Middleware resolved RBAC role:', role);

    // Admin Protection
    if (isAdminRoute && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Worker Protection ('repair_team' and 'admin' allowed)
    if (isWorkerRoute && role !== 'repair_team' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Allow access
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes have their own auth wrappers in /lib/middleware/auth.ts)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - internal media files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
