import { createFileRoute, Outlet, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
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

type SortKey = "founder" | "first" | "last" | "handle" | "age" | "toys" | "scans" | "joined";
type Sort = { key: SortKey; dir: "asc" | "desc" };
const SORT_KEY = "ts_admin_members_sort";
const DEFAULT_SORT: Sort = { key: "founder", dir: "asc" };

const SORT_OPTIONS: { value: string; label: string; key: SortKey; dir: "asc" | "desc" }[] = [
  { value: "founder:asc", label: "Founder # (1 → N)", key: "founder", dir: "asc" },
  { value: "founder:desc", label: "Founder # (N → 1)", key: "founder", dir: "desc" },
  { value: "first:asc", label: "First name (A → Z)", key: "first", dir: "asc" },
  { value: "last:asc", label: "Last name (A → Z)", key: "last", dir: "asc" },
  { value: "handle:asc", label: "@handle (A → Z)", key: "handle", dir: "asc" },
  { value: "age:asc", label: "Age (18+ first)", key: "age", dir: "asc" },
  { value: "toys:desc", label: "Toys (most first)", key: "toys", dir: "desc" },
  { value: "scans:desc", label: "Scans today (most first)", key: "scans", dir: "desc" },
  { value: "joined:desc", label: "Joined (newest first)", key: "joined", dir: "desc" },
  { value: "joined:asc", label: "Joined (oldest first)", key: "joined", dir: "asc" },
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function lastWord(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

function sortMembers(rows: Member[], sort: Sort): Member[] {
  const { key, dir } = sort;
  const mul = dir === "asc" ? 1 : -1;
  // emptyBottom: true when a missing value must always sink regardless of direction
  const cmp = (a: Member, b: Member): number => {
    switch (key) {
      case "founder": {
        const an = a.founder_no == null, bn = b.founder_no == null;
        if (an || bn) return an === bn ? 0 : an ? 1 : -1;
        return (a.founder_no! - b.founder_no!) * mul;
      }
      case "first": {
        const an = a.name?.trim() ?? "", bn = b.name?.trim() ?? "";
        if (!an || !bn) return !an === !bn ? 0 : !an ? 1 : -1;
        return collator.compare(an, bn) * mul;
      }
      case "last": {
        const an = a.name?.trim() ?? "", bn = b.name?.trim() ?? "";
        if (!an || !bn) return !an === !bn ? 0 : !an ? 1 : -1;
        return collator.compare(lastWord(an), lastWord(bn)) * mul;
      }
      case "handle":
        return collator.compare(a.handle ?? "", b.handle ?? "") * mul;
      case "age": {
        const rank = (m: Member) => (m.age_range === "13-17" ? 1 : m.age_range ? 0 : 2);
        const r = rank(a) - rank(b);
        if (r !== 0) return r * mul;
        return collator.compare(a.age_range ?? "", b.age_range ?? "") * mul;
      }
      case "toys":
        return (a.items - b.items) * mul;
      case "scans":
        return (a.scans_today - b.scans_today) * mul;
      case "joined":
        return collator.compare(a.created_at ?? "", b.created_at ?? "") * mul;
    }
  };
  return [...rows].sort(cmp);
}

function loadSort(): Sort {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Sort;
      if (SORT_OPTIONS.some((o) => o.key === p.key && o.dir === p.dir)) return p;
    }
  } catch { /* ignore */ }
  return DEFAULT_SORT;
}

function toCsv(rows: Member[]) {
  const cols: (keyof Member)[] = ["id", "handle", "name", "email", "provider", "founder_no", "founder_tier", "plan", "pro_until", "age_range", "city", "created_at", "items", "scans_today", "strikes", "restricted_until", "suspended"];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function Members() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<Sort>(loadSort);
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { try { localStorage.setItem(SORT_KEY, JSON.stringify(sort)); } catch { /* ignore */ } }, [sort]);
  const list = useQuery({ queryKey: ["members", dq, plan], queryFn: () => rpc<Member[]>("admin_members", { p_q: dq, p_plan: plan }) });

  const rows = sortMembers(list.data ?? [], sort);
  const toggleSort = (key: SortKey, defaultDir: "asc" | "desc") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
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
        <div className="sm:w-56">
          <label htmlFor="ms" className="sr-only">Sort by</label>
          <select id="ms" className="field" value={`${sort.key}:${sort.dir}`}
            onChange={(e) => { const o = SORT_OPTIONS.find((o) => o.value === e.target.value); if (o) setSort({ key: o.key, dir: o.dir }); }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {list.error ? <ErrorBox error={list.error} /> : list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
      ) : !rows.length ? <Empty>No members match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {([
                  ["Member", "first", "asc"],
                  ["Founder #", "founder", "asc"],
                  ["Plan", null, null],
                  ["Sign-in", null, null],
                  ["Age", "age", "asc"],
                  ["Toys", "toys", "desc"],
                  ["Scans today", "scans", "desc"],
                  ["Joined", "joined", "desc"],
                  ["Status", null, null],
                ] as [string, SortKey | null, "asc" | "desc" | null][]).map(([h, key, def]) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {key ? (
                      <button type="button" onClick={() => toggleSort(key, def!)}
                        className="inline-flex min-h-11 items-center gap-1 uppercase tracking-wide hover:text-foreground"
                        aria-label={`Sort by ${h}`}>
                        {h}
                        {sort.key === key && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    ) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
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
