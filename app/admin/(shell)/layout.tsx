import Nav, { PhoneTop } from '@/components/Nav';
import { logout } from '@/lib/actions';
import { authEnabled } from '@/lib/auth';
import { q } from '@/lib/db';

export default async function Shell({ children }: { children: React.ReactNode }) {
  const [{ n }] = await q<{ n: number }>("SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'requested'");
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-top">
          <div className="brand">
            <b>ABS</b>
            <span>Admin Hub</span>
          </div>
          <PhoneTop showLogout={authEnabled()} logout={logout} />
        </div>
        <Nav pending={n} />
        {authEnabled() && (
          <div className="side-foot">
            <form action={logout}>
              <button className="linklike" type="submit">Log out</button>
            </form>
          </div>
        )}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
