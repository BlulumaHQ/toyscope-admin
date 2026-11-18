import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCcw, Send } from "lucide-react";
import { ago, rpc, sb } from "@/lib/sb";
import { Empty, ErrorBox, PageHeader, Skel, MaskedEmail } from "@/components/admin/bits";

type Thread = { user_id: string; handle: string | null; email: string | null; status: "open" | "done"; last_at: string; last_sender: "user" | "admin" | null; admin_unread: number; last_body: string | null };
type Msg = { id: string; user_id: string; sender: "user" | "admin"; body: string; image_path: string | null; meta: Record<string, unknown>; created_at: string };

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support · ToyScope Admin" }, { name: "description", content: "ToyScope member support chats." }, { property: "og:title", content: "Support · ToyScope Admin" }, { property: "og:description", content: "ToyScope member support chats." }] }),
  component: Support,
});

const FILTERS = [["open", "Open"], ["done", "Done"], ["all", "All"]] as const;

function Support() {
  const [filter, setFilter] = useState("open");
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["support", filter], queryFn: () => rpc<Thread[]>("admin_support_threads", { p_status: filter }), refetchInterval: 30_000 });
  const current = q.data?.find((t) => t.user_id === sel) ?? null;

  return (
    <>
      <div className={sel ? "hidden lg:block" : ""}>
        <PageHeader title="Support" right={
          <div className="w-36"><label htmlFor="sf" className="sr-only">Filter</label>
            <select id="sf" className="field" value={filter} onChange={(e) => { setFilter(e.target.value); setSel(null); }}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>} />
      </div>
      {q.error ? <ErrorBox error={q.error} /> : q.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-20" />)}</div>
        : !q.data?.length ? <Empty>No conversations here.</Empty> : (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <ul className={`space-y-2 ${sel ? "hidden lg:block" : ""}`}>
              {q.data.map((t) => (
                <li key={t.user_id}>
                  <button type="button" onClick={() => setSel(t.user_id)}
                    className={`card w-full p-4 text-left ${sel === t.user_id ? "ring-2 ring-primary" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">@{t.handle ?? "member"}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {ago(t.last_at)}
                        {t.admin_unread > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{t.admin_unread}</span>}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.last_sender === "admin" ? "You: " : ""}{t.last_body || "📷 Screenshot"}</p>
                  </button>
                </li>
              ))}
            </ul>
            {current ? <Conversation key={current.user_id} t={current} onBack={() => setSel(null)} />
              : <div className="hidden lg:block"><Empty>Select a conversation.</Empty></div>}
          </div>
        )}
    </>
  );
}

function Conversation({ t, onBack }: { t: Thread; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);
  const m = useQuery({ queryKey: ["support-msgs", t.user_id], queryFn: () => rpc<Msg[]>("admin_support_messages", { p_user: t.user_id }), refetchInterval: 20_000 });

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["support-unread"] });
    const need = (m.data ?? []).map((x) => x.image_path).filter((p): p is string => !!p && !urls[p]);
    if (!need.length) return;
    sb().storage.from("support").createSignedUrls(need, 3600).then(({ data }) => {
      const add: Record<string, string> = {};
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) add[d.path] = d.signedUrl; });
      setUrls((u) => ({ ...u, ...add }));
    });
    end.current?.scrollIntoView({ block: "end" });
  }, [m.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await rpc("admin_support_reply", { p_user: t.user_id, p_body: text.trim() });
      setText("");
      qc.invalidateQueries({ queryKey: ["support-msgs", t.user_id] }); qc.invalidateQueries({ queryKey: ["support"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send"); }
    setBusy(false);
  };
  const setStatus = async (status: "open" | "done") => {
    try {
      await rpc("admin_support_status", { p_user: t.user_id, p_status: status });
      toast.success(status === "done" ? "Marked done" : "Reopened");
      qc.invalidateQueries({ queryKey: ["support"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  };
  const last = [...(m.data ?? [])].reverse().find((x) => x.sender === "user");
  const meta = last?.meta ?? {};

  return (
    <section className="card flex min-h-[70vh] flex-col p-0" aria-label={`Conversation with @${t.handle ?? "member"}`}>
      <header className="flex items-center gap-2 border-b p-3">
        <button type="button" className="grid size-11 place-items-center rounded-lg hover:bg-muted lg:hidden" onClick={onBack} aria-label="Back to list"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">@{t.handle ?? "member"}</div>
          <div className="truncate text-xs text-muted-foreground"><MaskedEmail email={t.email} /></div>
        </div>
        {t.status === "open"
          ? <button type="button" className="btn" onClick={() => setStatus("done")}><Check className="size-4" />Done</button>
          : <button type="button" className="btn" onClick={() => setStatus("open")}><RotateCcw className="size-4" />Reopen</button>}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {m.isLoading ? <Skel className="h-24" /> : (m.data ?? []).map((x) => (
          <div key={x.id} className={`flex ${x.sender === "admin" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${x.sender === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {x.image_path && urls[x.image_path] && (
                <a href={urls[x.image_path]} target="_blank" rel="noreferrer"><img src={urls[x.image_path]} alt="Screenshot from member" className="mb-2 max-h-72 rounded-lg" /></a>
              )}
              {x.body && <p className="whitespace-pre-wrap break-words">{x.body}</p>}
              <div className="mt-1 text-right text-[11px] opacity-70">{new Date(x.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {Object.keys(meta).length > 0 && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">{Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</p>
      )}
      <div className="flex items-end gap-2 border-t p-3">
        <label htmlFor="reply" className="sr-only">Reply</label>
        <textarea id="reply" className="field min-h-11 flex-1 resize-y" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply… (shows in their app)"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) reply(); }} />
        <button type="button" className="btn btn-primary min-h-11" disabled={busy || !text.trim()} onClick={reply}><Send className="size-4" />Send</button>
      </div>
    </section>
  );
}
