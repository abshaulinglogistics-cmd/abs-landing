'use client';
import { useState } from 'react';

export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

// Two-step delete so nothing is removed by one stray tap.
export function ConfirmButton({ action, label, confirmLabel = 'Tap again to confirm', className = 'btn danger sm' }: {
  action: () => Promise<void>;
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <form action={action} style={{ display: 'inline' }}>
      <button
        type={armed ? 'submit' : 'button'}
        className={className + (armed ? ' armed' : '')}
        onClick={(e) => {
          if (!armed) {
            e.preventDefault();
            setArmed(true);
            setTimeout(() => setArmed(false), 4000);
          }
        }}
      >
        {armed ? confirmLabel : label}
      </button>
    </form>
  );
}
