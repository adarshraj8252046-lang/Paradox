# Backend / API Layer

This folder contains the server-side business logic and API utilities for the Paradox Welfare Scheme Eligibility Platform.

## Structure

```
backend/
├── lib/
│   ├── eligibilityScorer.ts   — Weighted eligibility scoring engine (income, age, category, occupation, disability, state, BPL, etc.)
│   ├── concession.ts          — Automatic 50% concession logic (seniors 60+, BPL, students <25, persons with disability)
│   ├── agentAssignment.ts     — Specialization-aware agent load balancing and assignment logic
│   ├── indianStates.ts        — Indian states/UTs constants and lookup helpers
│   ├── utils.ts               — Shared server-side utilities (Aadhar validation, phone regex, file size checks)
│   └── i18n.json              — Internationalisation strings (multi-language label mappings)
├── hooks/
│   ├── usePlanAccess.ts       — Resolves active Saathi Plus / Pack plan access and quota for a given user+scheme
│   └── useSubscription.ts     — Reads active Saathi Plus annual subscription, expiry, and quota counters
└── README.md
```

## Key Modules

### Eligibility Scorer (`lib/eligibilityScorer.ts`)
Implements a weighted match calculation across 12+ dimensions:
- Income, age, caste/category, occupation, disability status
- State, area type (urban/rural), BPL status
- Marital status, government employee flag, minority status
- DBT eligibility, benefit type matching

### Concession Helper (`lib/concession.ts`)
Determines if a user qualifies for an automatic 50% fee discount:
- Age ≥ 60 (senior citizen)
- BPL card holder
- Student under age 25
- Person with disability

### Agent Assignment (`lib/agentAssignment.ts`)
Specialization-aware load balancing:
- Matches agents to scheme categories
- Distributes load evenly across available agents
- Falls back to general agents when specialists are unavailable

### Quota Debit Logic (`hooks/usePlanAccess.ts`)
Resolves which plan (Saathi Plus or scheme-specific Pack) covers a given scheme application:
- Plus subscription wins over Pack (priority order)
- Tracks calls_used vs calls_total and visits_used vs visits_total
- Exposes `plus_quota_exhausted` state for top-up CTA

## Dependency
This layer builds on top of the database schema committed by **Anwar** (see `database/`).
Tables used: `subscriptions`, `scheme_packs`, `agents`, `applications`, `eligibility_submissions`.
