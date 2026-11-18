import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { LayoutDashboard, Users, Flag, MessageSquare, MessagesSquare, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { rpc, sb } from "@/lib/sb";

type Ov = { open_reports: number; new_feedback: number };

export function Shell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [aal2, setAal2] = useState<boolean | undefined>(undefined);
  const qc = useQueryClient();

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb().auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "INITIAL_SESSION" || ev === "MFA_CHALLENGE_VERIFIED") setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setAdmin(undefined);
    if (!session) return;
    rpc<boolean>("am_admin").then((v) => setAdmin(!!v)).catch(() => setAdmin(false));
  }, [session?.user.id]);

  // Second factor: admin data only unlocks on an aal2 session.
  useEffect(() => {
    setAal2(undefined);
    if (!session) return;
    sb().auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => setAal2(data?.currentLevel === "aal2"));
  }, [session?.access_token]);

  // Auto sign-out 12 hours after signing in on this device.
  useEffect(() => {
    if (!session) return;
    const KEY = "ts_admin_signed_in_at";
    const at = Number(localStorage.getItem(KEY) || 0);
    if (!at) { localStorage.setItem(KEY, String(Date.now())); return; }
    const left = at + 12 * 3600_000 - Date.now();
    const out = () => { localStorage.removeItem(KEY); qc.clear(); sb().auth.signOut(); toast("Signed out after 12 hours. Please sign in again."); };
    if (left <= 0) { out(); return; }
    const t = setTimeout(out, left);
    return () => clearTimeout(t);
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => { qc.clear(); localStorage.removeItem("ts_admin_signed_in_at"); await sb().auth.signOut(); };

  if (session === undefined || (session && (admin === undefined || aal2 === undefined))) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!session) return <SignIn />;
  if (!admin) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <img src="/images/toyscope-logo.svg" alt="ToyScope" className="mx-auto h-8" />
          <h1 className="mt-6 text-lg font-bold">This account isn't an admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
          <button type="button" className="btn mt-6 w-full" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!aal2) return <SecondFactor onDone={() => setAal2(true)} onSignOut={signOut} />;
  return <Layout email={session.user.email ?? ""} onSignOut={signOut}>{children}</Layout>;
}

function Layout({ email, onSignOut, children }: { email: string; onSignOut: () => void; children: ReactNode }) {
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => rpc<Ov>("admin_overview"), refetchInterval: 60_000 });
  const sup = useQuery({ queryKey: ["support-unread"], queryFn: () => rpc<number>("admin_support_unread"), refetchInterval: 30_000 });
  const nav = [
    { to: "/" as const, label: "Overview", icon: LayoutDashboard, badge: 0 },
    { to: "/members" as const, label: "Members", icon: Users, badge: 0 },
    { to: "/reports" as const, label: "Reports", icon: Flag, badge: ov.data?.open_reports ?? 0 },
    { to: "/support" as const, label: "Support", icon: MessagesSquare, badge: sup.data ?? 0 },
    { to: "/feedback" as const, label: "Feedback", icon: MessageSquare, badge: ov.data?.new_feedback ?? 0 },
  ];
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between px-4 pt-3 md:block md:px-5 md:pt-6">
          <div>
            <img src="/images/toyscope-logo-white.svg" alt="ToyScope" className="h-[30px]" />
            <div className="mt-1 text-[10px] font-bold tracking-[0.2em] text-sidebar-muted">ADMIN</div>
          </div>
          <button type="button" onClick={onSignOut} className="grid size-11 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent md:hidden" aria-label="Sign out">
            <LogOut className="size-5" />
          </button>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-2 md:mt-6 md:flex-col md:py-0">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "!bg-primary !text-primary-foreground" }}>
              <n.icon className="size-4" />
              <span>{n.label}</span>
              {n.badge > 0 && <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{n.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-sidebar-accent p-4 md:block">
          <div className="truncate text-xs text-sidebar-muted" title={email}>{email}</div>
          <button type="button" onClick={onSignOut} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" /> Sign out
          </button>
          <p className="mt-3 text-[10px] text-sidebar-muted">© {year} ToyScope. Website by <a className="underline" href="https://bluluma.com" target="_blank" rel="noreferrer">Bluluma Design</a></p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <p className="mt-10 text-center text-xs text-muted-foreground md:hidden">© {year} ToyScope. Website by <a className="underline" href="https://bluluma.com" target="_blank" rel="noreferrer">Bluluma Design</a></p>
      </main>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true); toast.success("Code sent. Check your inbox.");
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await sb().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-sm p-8">
        <img src="/images/toyscope-logo.svg" alt="ToyScope" className="h-8" />
        <h1 className="mt-6 text-xl font-bold">Admin sign in</h1>
        {!sent ? (
          <form onSubmit={send} className="mt-4 space-y-3">
            <label className="block text-sm font-medium" htmlFor="em">Email</label>
            <input id="em" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">We sent a code to <strong className="text-foreground">{email}</strong>.</p>
            <label className="block text-sm font-medium" htmlFor="otp">Code</label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} required
              className="field text-center text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} />
            <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>{busy ? "Verifying…" : "Sign in"}</button>
            <button type="button" className="btn w-full" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  );
}

function SecondFactor({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb().auth.mfa.listFactors();
      if (error) { setErr(error.message); return; }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) { setFactorId(verified.id); return; }
      // Clean up half-finished enrolments, then start a fresh one.
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) await sb().auth.mfa.unenroll({ factorId: f.id });
      const en = await sb().auth.mfa.enroll({ factorType: "totp", friendlyName: "ToyScope Admin" });
      if (en.error) { setErr(en.error.message); return; }
      setFactorId(en.data.id); setQr(en.data.totp.qr_code); setSecret(en.data.totp.secret);
    })();
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); if (!factorId) return;
    setBusy(true);
    const { error } = await sb().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); setCode(""); return; }
    toast.success("Verified"); onDone();
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-sm p-8">
        <img src="/images/toyscope-logo.svg" alt="ToyScope" className="h-8" />
        <h1 className="mt-6 flex items-center gap-2 text-xl font-bold"><ShieldCheck className="size-5" />Two-step verification</h1>
        {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : qr ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">One-time setup: open Google Authenticator (or any authenticator app), tap +, and scan this code.</p>
            <img src={qr} alt="QR code for your authenticator app" className="mx-auto mt-4 size-48 rounded-lg bg-white p-2" />
            {secret && <p className="mt-2 break-all text-center font-mono text-xs text-muted-foreground">Can’t scan? Enter: {secret}</p>}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        )}
        <form onSubmit={verify} className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="totp">Authenticator code</label>
          <input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
            className="field text-center text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button className="btn btn-primary w-full" disabled={busy || code.length < 6 || !factorId}>{busy ? "Checking…" : "Verify"}</button>
          <button type="button" className="btn w-full" onClick={onSignOut}>Sign out</button>
        </form>
      </div>
    </div>
  );
}
