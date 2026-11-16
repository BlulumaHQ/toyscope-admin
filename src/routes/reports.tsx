import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageOff } from "lucide-react";
import { ago, itemPhoto, rpc } from "@/lib/sb";
import { Confirm, Empty, ErrorBox, PageHeader, Skel } from "@/components/admin/bits";

type Report = {
  id: string; reason: string; status: string; created_at: string; target_type: string; target_id: string;
  reporter_handle: string | null; item_name: string | null; item_photo: string | null; item_rating: string | null;
  owner_id: string | null; owner_handle: string | null; owner_strikes: number;
};

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · ToyScope Admin" }, { name: "description", content: "ToyScope content reports." }, { property: "og:title", content: "Reports · ToyScope Admin" }, { property: "og:description", content: "ToyScope content reports." }] }),
  component: Reports,
});

function useNow() {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return n;
}

function Countdown({ created, now }: { created: string; now: number }) {
  const left = new Date(created).getTime() + 86_400_000 - now;
  if (left <= 0) return <span className="pill bg-destructive text-destructive-foreground">Overdue</span>;
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return <span className={`pill ${h < 6 ? "bg-danger-soft text-destructive" : "bg-warning-soft text-warning"}`}>{h}h {m}m left</span>;
}

function Reports() {
  const [tab, setTab] = useState<"open" | "done">("open");
  const qc = useQueryClient();
  const now = useNow();
  const q = useQuery({
    queryKey: ["reports", tab],
    queryFn: async () => {
      if (tab === "open") return rpc<Report[]>("admin_reports", { p_status: "open" });
      const all = await rpc<Report[]>("admin_reports", { p_status: "all" });
      return all.filter((r) => r.status !== "open");
    },
  });
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["reports"] }); qc.invalidateQueries({ queryKey: ["overview"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
  };
  const resolve = (r: Report, action: string, ok: string) => act(() => rpc("admin_resolve_report", { p_id: r.id, p_action: action, p_reason: r.reason }), ok);
  const rate = (r: Report, rating: string) => act(() => rpc("admin_set_rating", { p_item: r.target_id, p_rating: rating }), `Marked ${rating}`);

  return (
    <>
      <PageHeader title="Reports" sub="Apple expects reports to be handled within 24 hours." />
      <div role="tablist" className="mb-4 inline-flex rounded-xl border bg-card p-1">
        {(["open", "done"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`min-h-10 rounded-lg px-5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "open" ? "Open" : "Done"}
          </button>
        ))}
      </div>
      {q.error ? <ErrorBox error={q.error} /> : q.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-40" />)}</div>
        : !q.data?.length ? <Empty>{tab === "open" ? "No open reports. Nice." : "No handled reports yet."}</Empty> : (
          <div className="space-y-3">
            {q.data.map((r) => (
              <article key={r.id} className="card flex flex-col gap-4 p-4 sm:flex-row">
                <Thumb r={r} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{r.item_name ?? `${r.target_type} report`}</h2>
                      <p className="mt-0.5 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "open" ? <Countdown created={r.created_at} now={now} /> : <span className="pill bg-muted capitalize text-muted-foreground">{r.status}</span>}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reported by @{r.reporter_handle ?? "unknown"} · Owner{" "}
                    {r.owner_id ? <Link to="/members/$id" params={{ id: r.owner_id }} className="font-medium text-primary hover:underline">@{r.owner_handle}</Link> : "—"}
                    {" "}({r.owner_strikes} strike{r.owner_strikes === 1 ? "" : "s"}) · Reported {ago(r.created_at)}
                  </p>
                  {r.status === "open" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.target_type === "item" || r.item_name ? (
                        <>
                          <button type="button" className="btn" onClick={() => rate(r, "sensitive")}>Mark sensitive</button>
                          <Confirm title="Mark as prohibited?" body="This item will be treated as prohibited content and removed from public view." confirmLabel="Mark prohibited" danger
                            onConfirm={() => rate(r, "prohibited")} trigger={(o) => <button type="button" className="btn" onClick={o}>Mark prohibited</button>} />
                        </>
                      ) : null}
                      <button type="button" className="btn" onClick={() => resolve(r, "hide", "Listing hidden")}>Hide listing</button>
                      <button type="button" className="btn btn-danger-outline" onClick={() => resolve(r, "strike", "Listing hidden and strike given")}>Hide + give strike</button>
                      <Confirm title={`Suspend @${r.owner_handle}?`} body="The seller will be suspended and this report closed." confirmLabel="Suspend seller" danger
                        onConfirm={() => resolve(r, "suspend", "Seller suspended")} trigger={(o) => <button type="button" className="btn btn-danger-outline" onClick={o}>Suspend seller</button>} />
                      <button type="button" className="btn" onClick={() => resolve(r, "dismiss", "Report dismissed")}>Dismiss</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
    </>
  );
}

function Thumb({ r }: { r: Report }) {
  const sensitive = r.item_rating === "sensitive" || r.item_rating === "prohibited";
  const [shown, setShown] = useState(!sensitive);
  const url = itemPhoto(r.item_photo);
  if (!url) return <div className="grid size-28 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageOff className="size-6" /></div>;
  return (
    <button type="button" className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-muted" onClick={() => setShown(true)} aria-label={shown ? "Item photo" : "Reveal sensitive photo"}>
      <img src={url} alt={r.item_name ?? "Reported item"} className={`size-full object-cover ${shown ? "" : "scale-110 blur-xl"}`} />
      {!shown && <span className="pill absolute inset-x-0 bottom-2 mx-auto w-fit bg-foreground/80 text-background">Sensitive · tap</span>}
    </button>
  );
}
