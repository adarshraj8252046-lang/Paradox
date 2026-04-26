# Integration Layer

This folder wires the Paradox Welfare platform to external services (Supabase Auth, Supabase Storage). It sits between the backend business logic (see `backend/`) and the frontend UI.

## Structure

```
integration/
├── supabase/
│   ├── client.ts          — Supabase JS client initialisation (reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY)
│   └── types.ts           — Auto-generated TypeScript types for all DB tables/views/enums
├── auth/
│   ├── AuthContext.tsx    — React context: user/session state, signIn, signUp, signOut, resetPassword
│   ├── AuthCallback.tsx   — /auth/callback route: exchanges email-link tokens for sessions, handles expired links
│   ├── ResetPassword.tsx  — /reset-password page: accepts the reset link and lets the user set a new password
│   └── ProtectedRoute.tsx — Route guard: redirects unauthenticated users to /auth
├── storage/
│   └── uploadHelpers.ts   — Supabase Storage upload pipeline for the `application-docs` bucket
└── README.md
```

## Key Responsibilities

### Supabase Client (`supabase/client.ts`)
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from environment
- Initialises the typed Supabase JS client with `persistSession: true` and `autoRefreshToken: true`
- Import as: `import { supabase } from "@/integrations/supabase/client"`

### Auth Wiring (`auth/`)
- **AuthContext**: Registers `onAuthStateChange` before `getSession()` (Supabase best-practice) to avoid missing events
- **AuthCallback**: Polls for session after email-link redirect; handles `otp_expired` errors gracefully with a resend UI
- **ResetPassword**: Accepts the Supabase password-reset link and allows the user to set a new password
- **ProtectedRoute**: Wraps all authenticated routes; falls back to `/auth` for unauthenticated visitors

### Storage Upload Pipeline (`storage/uploadHelpers.ts`)
Client-side validation gate (runs before any network call):
- Max **3 MB** per file
- Max **10 files** per application
- Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`

Upload path scoping:
```
application-docs/${user.id}/${application_id}/${timestamp}_${filename}
```

Convenience function `uploadAndSaveDocs()` uploads files AND writes rows to `application_documents` table in one call.

## Environment Variables
Copy `.env.example` → `.env` and fill in your Supabase project credentials.
**Never commit `.env`** — it is gitignored.

## Dependencies
- Builds on the database schema committed by **Anwar** (`database/`)
- Uses business logic from **Indranil's** backend layer (`backend/`)
- Tables used: `subscriptions`, `scheme_packs`, `topup_purchases`, `notifications`, `application_documents`
