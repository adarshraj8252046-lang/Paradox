# Payment Gateway

This folder contains the dummy payment gateway integration for the Paradox Welfare platform. It simulates Razorpay-style UPI, Card, and Net Banking flows for the development phase.

## Structure

```
payment-gateway/
├── PaymentModal.tsx   — Generic payment wall dispatched by purpose; writes to Supabase on success
├── PaywallModal.tsx   — Pre-payment gate: checks plan access and presents the appropriate CTA
└── README.md
```

## Payment Flows

### PaymentModal (`PaymentModal.tsx`)
Handles four distinct payment purposes via a `purpose` prop:

| Purpose | Action | DB Write |
|---|---|---|
| `saathi_plus_annual` | Buy/renew annual Saathi Plus plan | Upserts into `subscriptions` (365-day expiry, 15 calls, 3 visits) |
| `scheme_pack` | Buy a 45-day pack for one scheme | Inserts into `scheme_packs` (3 calls, 1 visit) |
| `topup_call` | Add +1 consultation call | Inserts into `topup_purchases` + increments `calls_total` on parent plan |
| `topup_visit` | Add +1 agent home visit | Inserts into `topup_purchases` + increments `visits_total` on parent plan |

After every successful payment, a **notification row** is inserted so the user sees immediate confirmation.

### Payment Methods (Dummy)
- **UPI**: Accepts any non-empty UPI ID string + shows a placeholder QR code
- **Card**: Accepts card number, expiry, and CVV (no real validation — demo only)
- **Net Banking**: Dropdown of 10 major Indian banks

### Concession Display
The modal accepts `amount` (after concession) and `fullPrice` (before concession). When `concessionApplied=true`, it shows a strikethrough on the full price and a "50% concession applied" label.

### PaywallModal (`PaywallModal.tsx`)
Pre-payment gate that:
1. Checks the user's current plan access (Plus / Pack / none) via `usePlanAccess`
2. Presents contextual CTAs: "Buy Plus", "Buy Pack", or "Top-up quota"
3. Chains into `PaymentModal` on CTA click
4. Chains into `ApplyModal` on payment success

## Production Migration Note
To move to real Razorpay:
1. Replace `handlePay()` dummy delay with `Razorpay.open()` and verify the `payment_id` server-side
2. Set `VITE_RAZORPAY_KEY_ID` in your environment (see `.env.example`)
3. Add a Supabase Edge Function to verify payment signatures before writing DB rows

## Dependencies
- Supabase client from `integration/supabase/client.ts`
- Auth context from `integration/auth/AuthContext.tsx`
- Tables: `subscriptions`, `scheme_packs`, `topup_purchases`, `notifications`
