import { useState, type ReactNode } from "react";
import { fmtDate, isRestricted, type Member } from "@/lib/sb";

export function PlanPill({ m }: { m: Pick<Member, "founder_tier" | "plan"> }) {
  if (m.founder_tier === "lifetime") return <span className="pill bg-amber-soft text-amber-ink">Lifetime founder</span>;
  if (m.founder_tier === "founding") return <span className="pill bg-info-soft text-primary">Founding</span>;
  if (m.plan === "pro") return <span className="pill bg-success-soft text-success">Pro</span>;
  return <span className="pill bg-muted text-muted-foreground">Free</span>;
}

export function StatusPill({ m }: { m: Pick<Member, "suspended" | "restricted_until"> }) {
  if (m.suspended) return <span className="pill bg-danger-soft text-destructive">Suspended</span>;
  if (isRestricted(m)) return <span className="pill bg-warning-soft text-warning">Restricted until {fmtDate(m.restricted_until)}</span>;
  return <span className="pill bg-success-soft text-success">Active</span>;
}

export function Avatar({ m }: { m: Pick<Member, "name" | "handle"> }) {
  const c = (m.name || m.handle || "?").trim().charAt(0).toUpperCase();
  return <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{c}</span>;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="card border-destructive/40 bg-danger-soft p-4 text-sm text-destructive">Couldn't load: {error instanceof Error ? error.message : String(error)}</div>;
}

export function Confirm({
  title, body, confirmLabel, danger, onConfirm, trigger,
}: {
  title: string; body: ReactNode; confirmLabel: string; danger?: boolean;
  onConfirm: () => void | Promise<void>; trigger: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && setOpen(false)}>
          <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{title}</h2>
            <div className="mt-2 text-sm text-muted-foreground">{body}</div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy}
                onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
