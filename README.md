# eat-smart

Personal food-management app — track expiry dates, scan receipts with AI, and get push notifications before food goes to waste.

- **Android app** (primary, v1) — built with Expo / React Native
- **Web app** — deployed to GitHub Pages, works in any browser including iPhone Safari / Chrome

Live at: **https://mini-on-ai.github.io/eat-smart/**

---

## Features

- **Pantry** — list of items grouped by urgency (expires today / soon / later)
- **Receipt scanning** — photo or PDF, OCR'd by Claude to extract items + expiry dates automatically
- **Push notifications** — server-side alerts at 3 days, 1 day, and the day of expiry
- **Shopping list** — cross-off items; share as plain text
- **Stats** — consumption history, waste rate, category breakdown
- **Recovery screen** — restore accidentally deleted or consumed items
- **Dark mode** — follows system preference; manual toggle in the pantry header

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Expo SDK 54 (React Native 0.81, React 19) |
| Routing | expo-router v6 (file-based, typed routes) |
| Styling | NativeWind v4 (Tailwind 3) + CSS variables for dark mode |
| Backend | Supabase (Postgres + RLS + Storage + Edge Functions + Auth) |
| AI | Anthropic Claude (via Edge Function — key never in client) |
| State | TanStack Query v5 (with AsyncStorage persistence) + Zustand |
| Forms | react-hook-form + zod |
| Icons | lucide-react-native |

---

## Local development

### Prerequisites

- Node.js 22+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android emulator or physical device with Expo Go, **or** a web browser

### Setup

```bash
git clone https://github.com/mini-on-ai/eat-smart.git
cd eat-smart
npm install

# Copy the environment template and fill in your Supabase project keys
cp .env.example .env
# Edit .env with your EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Run

```bash
# Android (emulator or device)
npx expo start --android

# Web browser
npx expo start --web

# Interactive — pick platform in the terminal
npx expo start
```

---

## Environment variables

### Client (`.env`) — shipped in the app bundle

These are public and safe to be in the app bundle. They are prefixed `EXPO_PUBLIC_` so Expo bakes them in at build time.

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

See `.env.example` for the template.

### Server-side only — NEVER put these in `.env` with `EXPO_PUBLIC_` prefix

These live exclusively in Supabase Edge Function secrets (Settings → Edge Functions → Secrets):

| Secret | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `scan-receipt` — calls Claude for receipt OCR |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (auto-injected by Supabase) |

The `SUPABASE_SERVICE_ROLE_KEY` may also be in your local `.env` for running admin scripts (`scripts/`). It is gitignored and must never be committed.

---

## Deployment

### Android APK (EAS Build)

```bash
# One-time login
npx eas-cli login

# Build a preview APK
npx eas build --platform android --profile preview
```

### Web (GitHub Pages)

Pushes to `main` trigger a GitHub Actions workflow that:
1. Runs `expo export --platform web`
2. Copies `dist/index.html → dist/404.html` (SPA fallback)
3. Deploys to GitHub Pages at `https://mini-on-ai.github.io/eat-smart/`

See `.github/workflows/deploy.yml`.

---

## Architecture notes

### Auth

Magic-link via `supabase.auth.signInWithOtp` — no passwords. Session persisted in AsyncStorage (native) or localStorage (web). The `AuthProvider` in `lib/auth.tsx` exposes `useAuth() → { session, loading }`. Route groups gate access: `(auth)/*` redirects to `(app)` when signed in; `(app)/*` redirects to `(auth)/sign-in` when signed out.

### Dark mode

Theme state is managed by `ThemeProvider` in `lib/themeContext.tsx` — a plain `useState` that guarantees re-renders on all platforms including React Native Web. On web, toggling also sets the `.dark` / `.light` class on `<html>` so Tailwind CSS variables in `global.css` update. On native, `vars()` from NativeWind injects the correct CSS variable values into the component tree.

### Receipt scanning

1. Client uploads image/PDF to Supabase Storage (`receipts/{household_id}/...`)
2. Client calls the `scan-receipt` Edge Function with `{ image_path, household_id }`
3. Function verifies the caller is a member of the household (auth + authorisation check)
4. Function fetches the file, sends it to Claude, parses the JSON response
5. Returns a list of items for the user to confirm or edit before saving to `pantry_items`

### Data model

```
households          (multi-tenant, v1 = single household per user)
  └── household_members (user ↔ household, with push token)
  └── pantry_items  (name, category, quantity, unit, expires_on, status, price, purchased_at)
  └── receipts      (image_path, llm response, confirmation status)
  └── shopping_list_items
item_categories     (seed data — French names matching Claude's output)
```

All tables have Row Level Security enabled. Household data is only accessible to members via the `is_member_of(household_id)` helper function.

### Push notifications

Server-side via pg_cron + `send-expiry-notifications` Edge Function → Expo Push API. No local scheduled notifications in the client bundle.

---

## Security

- Anthropic API key lives only in Supabase Edge Function secrets — never in the client bundle
- The `scan-receipt` Edge Function enforces that the caller is authenticated and is a member of the target household before processing
- All database tables have RLS enabled; every query from the client app is scoped to the user's household
- `SUPABASE_SERVICE_ROLE_KEY` is gitignored and never committed

---

## Roadmap (v2)

- iOS native app build
- Household sharing / invite flow
- Recipe suggestions based on expiring items
- Macro / nutrition tracking
- Smart shopping list (learns from purchase history)
