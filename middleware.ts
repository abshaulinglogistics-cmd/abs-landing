import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, authEnabled, checkSession } from '@/lib/auth';

// Only /admin is private. The landing page, booking page, and customer-facing
// invoice and receipt links stay public.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();
  if (!authEnabled()) return NextResponse.next();
  if (await checkSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
