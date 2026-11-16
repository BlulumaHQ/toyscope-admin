import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flag, MessageSquare, Clock } from "lucide-react";
import { fmtDate, rpc, type Member } from "@/lib/sb";
import { Avatar, ErrorBox, PageHeader, PlanPill, Skel } from "@/components/admin/bits";

type Ov = {
  members: number; members_week: number; lifetime_used: number; founding_used: number; scans_today: number;
  scanners_today: number; scans_month: number; open_reports: number; new_feedback: number;
  by_day: { day: string; n: number }[]; founders_behind: { id: string; handle: string; founder_no: number; items: number; deadline: string }[];
};

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview · ToyScope Admin" }, { name: "description", content: "ToyScope admin overview." }, { property: "og:title", content: "Overview · ToyScope Admin" }, { property: "og:description", content: "ToyScope admin overview." }] }),
  component: Overview,
});

function Kpi({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: { pct: number; cls: string } }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
      {bar && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bar.cls}`} style={{ width: `${Math.min(100, bar.pct)}%` }} /></div>}
    </div>
  );
}

function Overview() {
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => rpc<Ov>("admin_overview") });
  const newest = useQuery({ queryKey: ["members", "", "all"], queryFn: () => rpc<Member[]>("admin_members", { p_q: "", p_plan: "all" }) });

  if (ov.error) return <ErrorBox error={ov.error} />;
  const d = ov.data;
  const max = Math.max(1, ...(d?.by_day ?? []).map((x) => x.n));
  const latest = [...(newest.data ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!d ? Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-32" />) : (
          <>
            <Kpi label="Members" value={d.members.toLocaleString()} sub={`+${d.members_week} this week`} />
            <Kpi label="Lifetime founders" value={`${d.lifetime_used} / 20`} bar={{ pct: (d.lifetime_used / 20) * 100, cls: "bg-amber" }} />
            <Kpi label="Founding members" value={`${d.founding_used} / 180`} bar={{ pct: (d.founding_used / 180) * 100, cls: "bg-primary" }} />
            <Kpi label="Scans today" value={d.scans_today.toLocaleString()} sub={`${d.scanners_today} members scanned`} />
            <Kpi label="Scans this month" value={d.scans_month.toLocaleString()} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">New members per day</h2>
          {!d ? <Skel className="mt-4 h-48" /> : (
            <div className="mt-4 flex h-48 items-end gap-1.5" role="img" aria-label="Bar chart of new members per day">
              {d.by_day.map((x) => (
                <div key={x.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">{x.n}</span>
                  <div className="w-full rounded-t-md bg-primary" style={{ height: `${(x.n / max) * 80}%`, minHeight: 2 }} title={`${x.day}: ${x.n}`} />
                  <span className="text-[10px] text-muted-foreground">{new Date(x.day).getDate()}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Needs you</h2>
          {!d ? <Skel className="mt-4 h-40" /> : (
            <ul className="mt-3 divide-y">
              <li><Link to="/reports" className="flex min-h-11 items-center gap-3 py-2 text-sm hover:text-primary"><Flag className="size-4 text-destructive" />{d.open_reports} open reports</Link></li>
              <li><Link to="/feedback" className="flex min-h-11 items-center gap-3 py-2 text-sm hover:text-primary"><MessageSquare className="size-4 text-primary" />{d.new_feedback} new feedback</Link></li>
              {d.founders_behind.map((f) => (
                <li key={f.id}><Link to="/members/$id" params={{ id: f.id }} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:text-primary">
                  <Clock className="size-4 shrink-0 text-amber" />@{f.handle} has {f.items} of 5 toys · deadline {fmtDate(f.deadline)}
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <h2 className="p-5 pb-3 font-semibold">Newest members</h2>
        {newest.isLoading ? <div className="space-y-2 p-5 pt-0">{[0, 1, 2].map((i) => <Skel key={i} className="h-10" />)}</div> : (
          <ul className="divide-y">
            {latest.map((m) => (
              <li key={m.id}><Link to="/members/$id" params={{ id: m.id }} className="flex min-h-14 items-center gap-3 px-5 py-2 hover:bg-muted">
                <Avatar m={m} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{m.name || "—"}</div><div className="truncate text-xs text-muted-foreground">@{m.handle}</div></div>
                <PlanPill m={m} />
                <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">{fmtDate(m.created_at)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
