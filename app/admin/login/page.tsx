import { redirect } from 'next/navigation';
import { login } from '@/lib/actions';
import { authEnabled } from '@/lib/auth';

export const metadata = { title: 'Log in' };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authEnabled()) redirect('/admin');
  const sp = await searchParams;
  return (
    <div className="login">
      <form className="box" action={login}>
        <div className="brand">
          <b>ABS</b>
          <span>Admin Hub</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>Hauling &amp; Logistics. Log in to manage the schedule, invoices and customers.</p>
        {sp.error === 'setup' && (
          <div className="note err">No password is set yet. In Vercel, add an ADMIN_PASSWORD environment variable (Settings, then Environment Variables), then redeploy.</div>
        )}
        {sp.error === '1' && <div className="note err" role="alert">That password was not right.</div>}
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <label className="f">Password
          <input type="password" name="password" autoComplete="current-password" autoFocus required />
        </label>
        <button className="btn" type="submit">Log in</button>
      </form>
    </div>
  );
}
