'use client';
import { useEffect, useState } from 'react';
import { pushPublicKey, removePushSubscription, savePushSubscription, sendTestPush } from '@/lib/actions';

type State = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  return `${os}${installed ? ' (app)' : br ? ` - ${br}` : ''}`;
}
async function registration() {
  return navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' });
}

export default function PushSetup() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      // iPhones only allow notifications for apps added to the home screen.
      if (ios && !installed) return setState('ios-install');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
        if (sub) await savePushSubscription(sub.toJSON() as any, deviceName()); // keep the server copy fresh
      } catch {
        setState('off');
      }
    })();
  }, []);

  async function turnOn() {
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return; }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const key = b64ToBytes(await pushPublicKey());
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe(); // start clean in case the server key changed
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await savePushSubscription(sub.toJSON() as any, deviceName());
      setState('on');
      setMsg('Done. This device will now get a notification for each new booking request.');
    } catch (e: any) {
      setMsg(`Could not turn on notifications: ${e?.message || e}`);
    } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true); setMsg('');
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState('off');
    } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMsg('');
    try {
      const r = await sendTestPush();
      setMsg(r.sent ? `Test sent to ${r.sent} device${r.sent === 1 ? '' : 's'}. It can take a few seconds to show up.` : 'No devices got the test. Try turning notifications off and on again.');
    } finally { setBusy(false); }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {state === 'loading' && <p className="muted small" style={{ margin: 0 }}>Checking this device...</p>}
      {state === 'ios-install' && (
        <div className="note">On iPhone, notifications only work from the home screen app. In Safari tap <b>Share</b>, then <b>Add to Home Screen</b>, open ABS Admin from your home screen, and come back to this page.</div>
      )}
      {state === 'unsupported' && <div className="note">This browser cannot show notifications. On Android use Chrome; on iPhone add ABS Admin to your home screen first.</div>}
      {state === 'blocked' && (
        <div className="note err">Notifications are blocked for ABS Admin on this device. Turn them on in your phone's Settings (Notifications, then ABS Admin, or the browser's site settings), then reload this page.</div>
      )}
      {state === 'off' && <div><button className="btn" type="button" onClick={turnOn} disabled={busy}>{busy ? 'Turning on...' : 'Turn on notifications on this device'}</button></div>}
      {state === 'on' && (
        <div className="actions">
          <span className="badge green">On for this device</span>
          <button className="btn ghost sm" type="button" onClick={test} disabled={busy}>Send a test</button>
          <button className="btn ghost sm" type="button" onClick={turnOff} disabled={busy}>Turn off here</button>
        </div>
      )}
      {msg && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}
