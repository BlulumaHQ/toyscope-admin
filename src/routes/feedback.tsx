import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, X } from "lucide-react";
import { ago, feedbackShot, rpc } from "@/lib/sb";
import { Empty, ErrorBox, PageHeader, Skel } from "@/components/admin/bits";

type Fb = {
  id: string; kind: "bug" | "idea" | "other"; body: string; device: string | null; lang: string | null; app_version: string | null;
  screenshot_path: string | null; status: string; created_at: string; user_id: string | null; handle: string | null; email: string | null;
};

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Feedback · ToyScope Admin" }, { name: "description", content: "ToyScope member feedback." }, { property: "og:title", content: "Feedback · ToyScope Admin" }, { property: "og:description", content: "ToyScope member feedback." }] }),
  component: Feedback,
});

const STATUSES = [["new", "New"], ["working", "Working on it"], ["fixed", "Fixed"], ["wont", "Won't do"]] as const;
const FILTERS = [["all", "All"], ...STATUSES] as const;

function KindPill({ k }: { k: Fb["kind"] }) {
  const cls = k === "bug" ? "bg-danger-soft text-destructive" : k === "idea" ? "bg-info-soft text-primary" : "bg-muted text-muted-foreground";
  return <span className={`pill ${cls}`}>{k === "bug" ? "Bug" : k === "idea" ? "Idea" : "Other"}</span>;
}

function Feedback() {
  const [filter, setFilter] = useState("new");
  const [sel, setSel] = useState<string | null>(null);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["feedback", filter], queryFn: () => rpc<Fb[]>("admin_feedback", { p_status: filter }) });
  const current = q.data?.find((f) => f.id === sel) ?? null;

  const setStatus = async (f: Fb, status: string) => {
    try {
      await rpc("admin_set_feedback", { p_id: f.id, p_status: status });
      toast.success(`Marked "${STATUSES.find((s) => s[0] === status)?.[1]}"`);
      qc.invalidateQueries({ queryKey: ["feedback"] }); qc.invalidateQueries({ queryKey: ["overview"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  };

  return (
    <>
      <PageHeader title="Feedback" right={
        <div className="w-48"><label htmlFor="ff" className="sr-only">Filter status</label>
          <select id="ff" className="field" value={filter} onChange={(e) => { setFilter(e.target.value); setSel(null); }}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>} />
      {q.error ? <ErrorBox error={q.error} /> : q.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-24" />)}</div>
        : !q.data?.length ? <Empty>No feedback here.</Empty> : (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <ul className="space-y-3">
              {q.data.map((f) => (
                <li key={f.id} className={`card p-4 ${sel === f.id ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSel(f.id)}>
                      <div className="flex flex-wrap items-center gap-2"><KindPill k={f.kind} /><span className="text-xs text-muted-foreground">@{f.handle ?? "anonymous"} · {f.device ?? "—"} · {f.lang ?? "—"} · {ago(f.created_at)}</span></div>
                      <p className="mt-2 line-clamp-3 text-sm">{f.body}</p>
                    </button>
                    <div className="w-40"><label htmlFor={`s-${f.id}`} className="sr-only">Status</label>
                      <select id={`s-${f.id}`} className="field" value={f.status} onChange={(e) => setStatus(f, e.target.value)}>
                        {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select></div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="lg:sticky lg:top-8 lg:self-start">
              {!current ? <Empty>Select feedback to see details.</Empty> : (
                <div className="card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2"><KindPill k={current.kind} /><span className="text-sm font-semibold">@{current.handle ?? "anonymous"}</span></div>
                    <button type="button" className="grid size-11 place-items-center rounded-lg hover:bg-muted" onClick={() => setSel(null)} aria-label="Close details"><X className="size-4" /></button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{current.body}</p>
                  <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Device</dt><dd>{current.device ?? "—"}</dd>
                    <dt className="text-muted-foreground">Language</dt><dd>{current.lang ?? "—"}</dd>
                    <dt className="text-muted-foreground">App version</dt><dd>{current.app_version ?? "—"}</dd>
                    <dt className="text-muted-foreground">Email</dt><dd className="break-all">{current.email ?? "—"}</dd>
                    <dt className="text-muted-foreground">Sent</dt><dd>{new Date(current.created_at).toLocaleString("en-US")}</dd>
                  </dl>
                  {feedbackShot(current.screenshot_path) && (
                    <a href={feedbackShot(current.screenshot_path)!} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border">
                      <img src={feedbackShot(current.screenshot_path)!} alt="Screenshot attached to feedback" className="max-h-96 w-full object-contain bg-muted" />
                    </a>
                  )}
                  {current.email && (
                    <a className="btn btn-primary mt-4 w-full" href={`mailto:${current.email}?subject=${encodeURIComponent("Re: your ToyScope feedback")}`}><Mail className="size-4" />Reply by email</a>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
    </>
  );
}
