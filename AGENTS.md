# eat-smart — agent notes

## Project
Personal food-management app, Android-first v1 for the user's wife. Long-term: iPhone too, household sharing, recipes, shopping lists, macro counting.

Approved v1 plan: `/Users/minion/.claude/plans/i-have-an-idea-expressive-snail.md`

## Stack
- Expo SDK 54 (React Native 0.81, React 19) + expo-router v6 (file-based routing, typed routes on)
- NativeWind v4 (Tailwind 3) — config in `tailwind.config.js`, global stylesheet at `global.css` imported in root layout
- Supabase (Postgres + RLS + Storage + Edge Functions + Auth) — cloud-hosted, magic-link auth
- TanStack Query (with AsyncStorage persistence) + Zustand
- react-hook-form + zod
- lucide-react-native for icons
- Path alias `@/*` → project root

## Auth model
- Magic link via `supabase.auth.signInWithOtp` with `shouldCreateUser: true`
- Session persisted in AsyncStorage (configured on the Supabase client)
- `AuthProvider` in `lib/auth.tsx` exposes `useAuth() => { session, loading }`
- Route groups gate auth: `app/(auth)/*` redirects to `(app)` when signed in; `app/(app)/*` redirects to `(auth)/sign-in` when signed out. `app/index.tsx` is the splash router.

## Env vars
Public client-side keys go in `.env` as `EXPO_PUBLIC_*` (Expo SDK 50+ native support). Service-role and Anthropic keys live only in Supabase Edge Function secrets — never in the app bundle.

## Future-proofing rules (v1 is Android-only, single-user — don't break v2)
- Keep schema multi-tenant (`households`, `household_members`) even though v1 has one user per household
- Server-side push (pg_cron + Edge Function → Expo push API), NOT local scheduled notifications
- Don't introduce iOS-specific code paths yet, but write platform-neutral code so iPhone is just a build target

## Expo SDK 54 caveats
Read the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing native module code. APIs change between SDKs.

## Don't do
- Don't put the Anthropic API key in the client — it lives in `supabase/functions/scan-receipt`
- Don't add Realtime subscriptions or invite/deep-link flow in v1 (deferred to v2)
- Don't introduce a global UI library — small hand-rolled `components/ui/*` on NativeWind
