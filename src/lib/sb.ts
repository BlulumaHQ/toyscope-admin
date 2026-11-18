import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SB_URL = "https://deknzrajghaatahmdrwn.supabase.co";
const SB_KEY = "sb_publishable_xOp7aSByxfPuyojXVo6-kg_F-aF4MB0";
export const SITE_URL = "https://admin.toyscope.app";

let client: SupabaseClient | null = null;
export function sb() {
  if (!client) {
    client = createClient(SB_URL, SB_KEY, {
      auth: { storageKey: "ts_admin_auth", persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const itemPhoto = (p?: string | null) => (p ? `${SB_URL}/storage/v1/object/public/items/${p}` : null);
export const feedbackShot = (p?: string | null) => (p ? `${SB_URL}/storage/v1/object/public/feedback/${p}` : null);

export type Member = {
  id: string; handle: string | null; name: string | null; email: string | null; provider: string | null;
  founder_no: number | null; founder_tier: "lifetime" | "founding" | null; plan: "pro" | "free";
  pro_until: string | null; age_range: "13-17" | "18+" | null; city: string | null; created_at: string;
  items: number; photos: number; scans_total: number; founder_confirmed: boolean; scans_today: number; strikes: number; restricted_until: string | null; suspended: boolean; is_admin: boolean;
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
export function ago(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const isRestricted = (m: Pick<Member, "restricted_until">) =>
  !!m.restricted_until && new Date(m.restricted_until).getTime() > Date.now();
