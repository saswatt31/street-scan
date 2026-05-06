import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
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
      // Get authenticated user
      let { data: { session } } = await supabase.auth.getSession();
      let user = session?.user;

      // SUPREME FALLBACK: If Supabase SSR drops the ball, we forcefully deserialize the verified cookie!
      if (!user) {
        const fallbackCookie = request.cookies.getAll().find(c => c.name.includes('-auth-token'));
        if (fallbackCookie) {
          try {
            const parsed = JSON.parse(fallbackCookie.value);
            user = parsed.user;
            await supabase.auth.setSession({ 
              access_token: parsed.access_token, 
              refresh_token: parsed.refresh_token 
            });
          } catch(e) { }
        }
      }
      
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }

      // 4. Role Check
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

      const { data: profile } = await sbAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
        
      const role = profile?.role;

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

    return supabaseResponse
  } catch (e) {
    console.error('Middleware crash:', e);
    return NextResponse.next();
  }
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
