import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { ago, fmtDate, isRestricted, rpc, type Member } from "@/lib/sb";
import { Confirm, ErrorBox, PlanPill, Skel, StatusPill } from "@/components/admin/bits";

type Detail = {
  profile: Member; scans_month: number; items_public: number; items_sale: number; items_sensitive: number;
  strikes: { reason: string; severe: boolean; at: string }[]; reports: { id: string; reason: string; status: string; at: string }[];
};

export const Route = createFileRoute("/members/$id")({
  head: () => ({ meta: [{ title: "Member · ToyScope Admin" }, { name: "description", content: "ToyScope member details." }, { property: "og:title", content: "Member · ToyScope Admin" }, { property: "og:description", content: "ToyScope member details." }] }),
  component: MemberPage,
});

const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

function MemberPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["member", id], queryFn: () => rpc<Detail>("admin_member", { p_id: id }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["member", id] }); qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["overview"] }); };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
  };

  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <div className="space-y-4"><Skel className="h-20" /><div className="grid gap-4 lg:grid-cols-2"><Skel className="h-64" /><Skel className="h-64" /></div></div>;
  const { profile: m } = q.data;

  return (
    <>
      <Link to="/members" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Members</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.name || "Unnamed"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>@{m.handle}</span>
            {m.founder_no != null && <span>· Founder #{m.founder_no}</span>}
            <span>· Joined {fmtDate(m.created_at)}</span>
            <PlanPill m={m} /><StatusPill m={m} />
            {m.age_range === "13-17" && <span className="pill bg-warning-soft text-warning">Minor</span>}
          </div>
        </div>
        {m.suspended ? (
          <button type="button" className="btn" onClick={() => act(() => rpc("admin_set_status", { p_id: id, p_suspended: false, p_clear_restriction: false }), "Member unsuspended")}>Unsuspend</button>
        ) : (
          <Confirm title={`Suspend @${m.handle}?`} body="They won't be able to use ToyScope until you unsuspend them." confirmLabel="Suspend" danger
            onConfirm={() => act(() => rpc("admin_set_status", { p_id: id, p_suspended: true, p_clear_restriction: false }), "Member suspended")}
            trigger={(open) => <button type="button" className="btn btn-danger-outline" onClick={open}>Suspend</button>} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard m={m} act={act} />
        <section className="card p-5">
          <h2 className="font-semibold">Community rules</h2>
          <p className="mt-1 text-sm text-muted-foreground">{m.strikes} strike{m.strikes === 1 ? "" : "s"}</p>
          {isRestricted(m) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
              <span className="font-semibold">Restricted until {fmtDate(m.restricted_until)}</span>
              <button type="button" className="btn" onClick={() => act(() => rpc("admin_set_status", { p_id: id, p_suspended: m.suspended, p_clear_restriction: true }), "Restriction lifted")}>Lift restriction</button>
            </div>
          )}
          {q.data.strikes.length > 0 && (
            <ul className="mt-3 divide-y text-sm">
              {q.data.strikes.map((s, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <span>{s.reason}{s.severe && <span className="pill ml-2 bg-danger-soft text-destructive">Serious</span>}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(s.at)}</span>
                </li>
              ))}
            </ul>
          )}
          <StrikeForm id={id} onDone={refresh} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Usage</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {[["Scans today", `${m.scans_today}/30`], ["Scans this month", q.data.scans_month], ["Toys public", q.data.items_public], ["For sale", q.data.items_sale], ["Marked sensitive", q.data.items_sensitive], ["Total toys", m.items]].map(([k, v]) => (
              <div key={k as string}><dt className="text-muted-foreground">{k}</dt><dd className="mt-0.5 text-xl font-bold">{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd className="break-all">{m.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Sign-in</dt><dd className="capitalize">{m.provider ?? "—"}</dd>
            <dt className="text-muted-foreground">Age range</dt><dd>{m.age_range ?? "—"}</dd>
            <dt className="text-muted-foreground">City</dt><dd>{m.city ?? "—"}</dd>
          </dl>
          <h3 className="mt-5 text-sm font-semibold">Reports about this member</h3>
          {q.data.reports.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">None.</p> : (
            <ul className="mt-2 divide-y text-sm">
              {q.data.reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{r.reason}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span className="pill bg-muted capitalize">{r.status}</span>{ago(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function PlanCard({ m, act }: { m: Member; act: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [choice, setChoice] = useState("");
  const [until, setUntil] = useState(() => addMonths(new Date(), 1).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const set = (plan: string, pro_until: string | null, tier: string, ok: string) =>
    act(() => rpc("admin_set_plan", { p_id: m.id, p_plan: plan, p_pro_until: pro_until, p_tier: tier }), ok);

  const save = async () => {
    setBusy(true);
    if (choice === "lifetime") await set("pro", "2999-12-31T23:59:59Z", "lifetime", "Set to Lifetime founder");
    if (choice === "founding") await set("pro", addMonths(new Date(), 6).toISOString(), "founding", "Set to Founding");
    if (choice === "pro") await set("pro", new Date(until + "T23:59:59").toISOString(), "keep", "Pro granted");
    if (choice === "free") await set("free", null, "none", "Set to Free");
    setBusy(false); setChoice("");
  };
  const extend = (n: number) => {
    const base = m.pro_until && new Date(m.pro_until) > new Date() ? new Date(m.pro_until) : new Date();
    return set("pro", addMonths(base, n).toISOString(), "keep", `+${n} month${n > 1 ? "s" : ""} Pro added`);
  };

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Plan</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><PlanPill m={m} />
        <span className="text-muted-foreground">{m.plan === "pro" ? (m.pro_until?.startsWith("2999") ? "Forever" : `Pro until ${fmtDate(m.pro_until)}`) : "No Pro access"}</span>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="plan" className="mb-1 block text-sm font-medium">Change plan to</label>
          <select id="plan" className="field" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose…</option>
            <option value="lifetime">Lifetime founder</option>
            <option value="founding">Founding (6 months Pro)</option>
            <option value="pro">Pro granted by admin</option>
            <option value="free">Free</option>
          </select>
        </div>
        {choice === "pro" && (
          <div><label htmlFor="until" className="mb-1 block text-sm font-medium">Pro until</label>
            <input id="until" type="date" className="field" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} /></div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!choice || busy} onClick={save}>Save</button>
          <button type="button" className="btn" onClick={() => extend(1)}>+1 month Pro</button>
          <button type="button" className="btn" onClick={() => extend(3)}>+3 months Pro</button>
        </div>
      </div>
      <div className="mt-4 flex gap-3 rounded-xl bg-info-soft p-3 text-sm text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Plans you set here control what this member can do in ToyScope. They don't change App Store or Google Play billing. Members who pay through Apple or Google keep being charged until they cancel there, and refunds go through Apple or Google Play Console.</p>
      </div>
    </section>
  );
}

function StrikeForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [severe, setSevere] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await rpc<{ strikes: number; outcome: string }>("admin_add_strike", { p_user: id, p_reason: reason.trim(), p_severe: severe });
      const msg = r.outcome === "suspended" ? "Strike given. Member suspended." : r.outcome === "restricted_7_days" ? "Strike given. Member restricted for 7 days." : "Strike given. Member warned.";
      toast.success(msg, { description: `${r.strikes} strike${r.strikes === 1 ? "" : "s"} total` });
      setReason(""); setSevere(false); onDone();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't give strike"); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Give a strike</h3>
      <div><label htmlFor="sr" className="mb-1 block text-sm font-medium">Reason</label>
        <input id="sr" required className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--destructive)]" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
        Serious (scam, threats, child safety) → suspend now
      </label>
      <p className="text-xs text-muted-foreground">1st strike = warning, 2nd = 7-day restriction, 3rd or serious = suspended.</p>
      <button className="btn btn-danger" disabled={busy || !reason.trim()}>Give strike</button>
    </form>
  );
}
