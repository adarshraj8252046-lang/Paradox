# Frontend Layer

This folder contains the React presentation layer for the Paradox Welfare Scheme Eligibility Platform.

## Structure

```
frontend/
├── pages/         — Top-level route components (Home, Check Eligibility, Dashboard, etc.)
├── components/    — Reusable UI components (Navbar, Scheme Cards, Modals, Forms)
├── contexts/      — Global React state (Language, Literacy Mode)
├── App.tsx        — Main App component and Router config
└── main.tsx       — React root render entry point
```

## Key Modules

### Pages
- **Home / Schemes Directory**: Lists schemes with filtering and search.
- **Check Eligibility**: Multi-step form with conditional fields (e.g., BPL details) for scoring.
- **Scheme Detail**: Full details, timeline, and Apply CTAs.
- **Dashboard / Profile**: User-specific views tracking plans, application status, and history.
- **Auth Views**: Sign-in, sign-up, and layout wrappers.

### Components
- **Navigation**: Navbar with literacy mode and language toggles.
- **Cards & Modals**: Scheme cards, Apply modal, Change Agent modal, Book Next Call modal, etc.
- **Forms**: Document upload components and dynamic inputs.

## Dependencies
- Relies on **Indranil's** backend logic for eligibility scoring and agent assignment.
- Relies on **Adarsh's** integration layer for AuthContext, Storage uploads, and Payment gateways.
- Uses **Daiva Deep Verma's** `ui-ux/` design system for Tailwind tokens and CSS styles.
