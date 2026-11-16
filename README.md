# ToyScope Admin

Build "ToyScope Admin": a private admin dashboard for my toy-collector app ToyScope. Desktop-first, works on phone. English UI.

IMPORTANT – backend:
- Do NOT enable Lovable Cloud or create any database. The data already lives in my existing Supabase project.
- Use @supabase/supabase-js in the browser with:
  URL: https://deknzrajghaatahmdrwn.supabase.co
  publishable (public) key: sb_publishable_xOp7aSByxfPuyojXVo6-kg_F-aF4MB0
- Sign-in: email one-time code (sb.auth.signInWithOtp({email, options:{shouldCreateUser:false}}) then sb.auth.verifyOtp({email, token, type:'email'})). Code is 6–8 digits; the input must accept 8 digits. Store the session with storageKey 'ts_admin_auth'.
- After sign-in call sb.rpc('is_admin'). If false: show "This account isn't an admin" and a Sign out button. Nothing else is visible to non-admins.
- All data comes ONLY from these RPCs (they already exist; every one throws 'not_admin' for non-admins):
  admin_overview() → json {members, members_week, lifetime_used, founding_used, scans_today, scanners_today, scans_month, open_reports, new_feedback, by_day:[{day,n}] (14 days), founders_behind:[{id,handle,founder_no,items,deadline}]}
  admin_members(p_q text, p_plan text) → rows {id, handle, name, email, provider, founder_no, founder_tier ('lifetime'|'founding'|null), plan ('pro'|'free'), pro_until, age_range ('13-17'|'18+'), city, created_at, items, scans_today, strikes, restricted_until, suspended, is_admin}. p_plan one of all|lifetime|founding|pro|free|suspended|restricted.
  admin_member(p_id uuid) → json {profile (same shape as a members row), scans_month, items_public, items_sale, items_sensitive, strikes:[{reason,severe,at}], reports:[{id,reason,status,at}]}
  admin_set_plan(p_id uuid, p_plan 'pro'|'free', p_pro_until timestamptz|null, p_tier 'keep'|'lifetime'|'founding'|'none')
  admin_set_status(p_id uuid, p_suspended boolean, p_clear_restriction boolean)
  admin_add_strike(p_user uuid, p_reason text, p_severe boolean) → {strikes, outcome:'warning'|'restricted_7_days'|'suspended'}
  admin_reports(p_status 'open'|'actioned'|'dismissed'|'all') → rows {id, reason, status, created_at, target_type, target_id, reporter_handle, item_name, item_photo (storage path), item_rating, owner_id, owner_handle, owner_strikes}
  admin_resolve_report(p_id uuid, p_action 'dismiss'|'hide'|'strike'|'suspend', p_reason text)
  admin_set_rating(p_item uuid, p_rating 'general'|'sensitive'|'prohibited')
  admin_feedback(p_status 'new'|'working'|'fixed'|'wont'|'all') → rows {id, kind ('bug'|'idea'|'other'), body, device, lang, app_version, screenshot_path, status, created_at, user_id, handle, email}
  admin_set_feedback(p_id uuid, p_status text)
- Photo URLs: item photos = `${URL}/storage/v1/object/public/items/${item_photo}`; feedback screenshots = `${URL}/storage/v1/object/public/feedback/${screenshot_path}`.

Brand:
- Logo (white version, for the dark sidebar): https://toyscope.app/brand/toyscope-logo-white.svg — put it at the top of the sidebar, ~30px tall, with a small "ADMIN" label under it. Full-color logo for light backgrounds (sign-in screen): https://toyscope.app/brand/toyscope-logo.svg. Favicon: https://toyscope.app/favicon.svg
- Brand blue #3851A3 (primary buttons, active nav), sidebar #0D1017, page #F5F6F8, cards white with #E4E7EE borders, 16px radius. Font Inter. Amber #F59E0B for lifetime founder, red for danger. No gradients, no emoji.

Layout: left dark sidebar nav (Overview, Members, Reports with open-count badge, Feedback with new-count badge), signed-in email + Sign out at the bottom. On phone the sidebar becomes a top scrollable bar.

Pages:
1. Overview – KPI cards: Members (+this week), Lifetime founders "X / 20" with amber progress bar, Founding members "X / 180" with blue bar, Scans today (+how many members scanned), Scans this month. Bar chart of new members per day (by_day). "Needs you" list: open reports, new feedback, and each lifetime founder in founders_behind ("@handle has N of 5 toys · deadline <date>"). Newest 5 members table.
2. Members – search box (name, @handle, email), plan filter, table: member (avatar initial, name, @handle, email), Founder #, plan pill (Lifetime founder amber / Founding blue / Pro green / Free grey), sign-in provider, age (13–17 shows a "Minor" pill), toys, scans today "/30", joined, status (Active / Restricted until <date> orange / Suspended red). Row click → member page. Export CSV button.
3. Member detail – header with name, @handle, founder #, joined; buttons Suspend/Unsuspend.
   - Plan card: current plan + pro_until; select "Change plan to": Lifetime founder (pro, until 2999-12-31, tier lifetime) / Founding (pro, 6 months from now, tier founding) / Pro granted by admin (pro, date picker) / Free (free, tier none); Save. Quick buttons "+1 month Pro" and "+3 months Pro" (extend from max(now, pro_until)).
   - Blue info box (always visible): "Plans you set here control what this member can do in ToyScope. They don't change App Store or Google Play billing. Members who pay through Apple or Google keep being charged until they cancel there, and refunds go through Apple or Google Play Console."
   - Community rules card: strikes count, list of strikes; "Give a strike" form (reason + "Serious (scam, threats, child safety) → suspend now" checkbox) calling admin_add_strike, then show the outcome in a toast: 1st = warning, 2nd = 7-day restriction, 3rd/serious = suspended. If restricted, show "Restricted until <date>" with a "Lift restriction" button (admin_set_status(id, suspended, true)).
   - Usage: scans today/30, scans this month, toys public / for sale / marked sensitive.
   - Account: email, sign-in provider, age range, city. Reports about this member.
4. Reports – tabs Open / Done. Each report card: item photo thumbnail (blurred with "Sensitive" chip if item_rating is sensitive or prohibited, click to reveal), item name, reason, reporter, owner @handle with strike count, "Reported X ago" and a 24-hour countdown pill (orange; red when under 6 hours; "Overdue" if past). Actions: "Mark sensitive" / "Mark prohibited" (admin_set_rating), "Hide listing" (hide), "Hide + give strike" (strike), "Suspend seller" (suspend, confirm dialog), "Dismiss". Small note: "Apple expects reports to be handled within 24 hours."
5. Feedback – list with Bug/Idea pills, text, @handle, device, language, time; status select (New, Working on it, Fixed, Won't do) calling admin_set_feedback; detail panel with screenshot and a "Reply by email" button that opens mailto:<email>?subject=Re: your ToyScope feedback (I send from support@toyscope.app in Gmail).

Polish: loading skeletons, empty states ("No open reports. Nice."), toasts for every action, confirm dialogs for suspend and prohibited. All buttons real <button>, labels on inputs, 44px touch targets, good contrast. Add <meta name="robots" content="noindex,nofollow">.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76c409d2-a5c6-4c45-aee0-03a399d5c7ce).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
