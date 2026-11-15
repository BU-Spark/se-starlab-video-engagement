/**
 * middleware.ts
 *
 * Keeps signed-out visitors away from the researcher pages and refreshes the researcher's
 * Supabase session cookie on each request. The database enforces the real access rules (RLS);
 * this only decides which page to show. The tablet (/tablet) never passes through here.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { HOME_PATH, LOGIN_PATH } from '@/app/researcher/_components/auth';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Without Supabase the researcher pages run as a local preview with nothing to protect.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() asks Supabase Auth to verify the token instead of trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;
  const onLogin = pathname === LOGIN_PATH;

  if (!user && !onLogin) {
    const login = request.nextUrl.clone();
    login.pathname = LOGIN_PATH;
    login.search = '?next=' + encodeURIComponent(pathname + search);
    return NextResponse.redirect(login);
  }
  if (user && (onLogin || pathname === '/researcher')) {
    const home = request.nextUrl.clone();
    home.pathname = HOME_PATH;
    home.search = '';
    return NextResponse.redirect(home);
  }
  return response;
}

export const config = {
  matcher: ['/researcher', '/researcher/:path*'],
};
