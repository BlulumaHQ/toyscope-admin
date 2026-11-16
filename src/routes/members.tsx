import { createFileRoute, Outlet, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { fmtDate, rpc, type Member } from "@/lib/sb";
import { Avatar, Empty, ErrorBox, PageHeader, PlanPill, Skel, StatusPill } from "@/components/admin/bits";

export const Route = createFileRoute("/members")({
  head: () => ({ meta: [{ title: "Members · ToyScope Admin" }, { name: "description", content: "ToyScope members." }, { property: "og:title", content: "Members · ToyScope Admin" }, { property: "og:description", content: "ToyScope members." }] }),
  component: MembersLayout,
});

function MembersLayout() {
  const child = useMatch({ from: "/members/$id", shouldThrow: false });
  return child ? <Outlet /> : <Members />;
}

const PLANS = ["all", "lifetime", "founding", "pro", "free", "suspended", "restricted"];

function toCsv(rows: Member[]) {
  const cols: (keyof Member)[] = ["id", "handle", "name", "email", "provider", "founder_no", "founder_tier", "plan", "pro_until", "age_range", "city", "created_at", "items", "scans_today", "strikes", "restricted_until", "suspended"];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function Members() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [plan, setPlan] = useState("all");
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useQuery({ queryKey: ["members", dq, plan], queryFn: () => rpc<Member[]>("admin_members", { p_q: dq, p_plan: plan }) });

  const exportCsv = () => {
    const blob = new Blob([toCsv(list.data ?? [])], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `toyscope-members-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <>
      <PageHeader title="Members" sub={list.data ? `${list.data.length} shown` : undefined}
        right={<button type="button" className="btn" onClick={exportCsv} disabled={!list.data?.length}><Download className="size-4" />Export CSV</button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="mq" className="sr-only">Search members</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="mq" className="field pl-9" placeholder="Search name, @handle, email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="sm:w-48">
          <label htmlFor="mp" className="sr-only">Plan filter</label>
          <select id="mp" className="field capitalize" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => <option key={p} value={p}>{p === "all" ? "All plans" : p}</option>)}
          </select>
        </div>
      </div>
      {list.error ? <ErrorBox error={list.error} /> : list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
      ) : !list.data?.length ? <Empty>No members match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Member", "Founder #", "Plan", "Sign-in", "Age", "Toys", "Scans today", "Joined", "Status"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {list.data.map((m) => (
                <tr key={m.id} tabIndex={0} className="cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none"
                  onClick={() => nav({ to: "/members/$id", params: { id: m.id } })}
                  onKeyDown={(e) => e.key === "Enter" && nav({ to: "/members/$id", params: { id: m.id } })}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar m={m} /><div className="min-w-0">
                    <div className="font-semibold">{m.name || "—"} <span className="font-normal text-muted-foreground">@{m.handle}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{m.email}</div></div></div></td>
                  <td className="px-4 py-3">{m.founder_no ?? "—"}</td>
                  <td className="px-4 py-3"><PlanPill m={m} /></td>
                  <td className="px-4 py-3 capitalize">{m.provider ?? "—"}</td>
                  <td className="px-4 py-3">{m.age_range === "13-17" ? <span className="pill bg-warning-soft text-warning">Minor</span> : m.age_range ?? "—"}</td>
                  <td className="px-4 py-3">{m.items}</td>
                  <td className="px-4 py-3">{m.scans_today}<span className="text-muted-foreground">/30</span></td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td className="px-4 py-3"><StatusPill m={m} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
