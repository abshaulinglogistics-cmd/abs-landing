import Link from 'next/link';
import { saveCustomer } from '@/lib/actions';
import { CustomerFields, Flash } from '@/components/ui';

export const metadata = { title: 'New customer' };

export default async function NewCustomer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="head"><h1>New customer</h1></div>
      <Flash sp={sp} />
      <form action={saveCustomer.bind(null, null)} className="card stack" style={{ maxWidth: 760 }}>
        <CustomerFields />
        <div className="actions"><button className="btn" type="submit">Save customer</button><Link className="btn ghost" href="/admin/customers">Cancel</Link></div>
      </form>
    </>
  );
}
