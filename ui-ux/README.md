# UI/UX & Design System

This folder defines the visual identity and styling tokens for the Paradox Welfare Scheme Eligibility Platform.

## Structure

```
ui-ux/
├── styles/
│   ├── index.css          — Global CSS, Tailwind imports, custom font faces
│   └── App.css            — Application-specific overrides
├── public/                — Static assets (logos, icons, illustrations)
├── tailwind.config.ts     — Core design tokens (colors, typography, spacing)
└── postcss.config.js      — PostCSS configuration for Tailwind processing
```

## Design Language (WelfareConnect)

The platform uses a standardized, accessible color palette to ensure trust and legibility, especially for government-related services.

### Core Colors
- **Navy** (`#1F3864`): Primary brand color, used for headers, primary buttons, and strong emphasis.
- **Link Blue** (`#2E5FA3`): Interactive elements, text links, and secondary buttons.
- **Border Blue** (`#AACDE0`): Input borders, card outlines, and dividers.
- **Cell Blue** (`#D6E4F0`): Table headers, alternating row backgrounds, and subtle highlights.

### Status Colors
- **Success Green** (`#16A34A`): Validations, approvals, successful document uploads.
- **Warning Amber** (`#FFF3CD`): Pending states, warnings, and missing information.
- **Destructive Red** (`#DC2626`): Errors, rejections, and critical destructive actions.

## Accessibility
- **Dark Backgrounds**: Ensured that any section with a dark background (like Navy) uses pure white (`#FFFFFF`) text for optimal contrast.
- **Literacy Mode**: Supported through global state (managed in `frontend/contexts`) and specific styling adjustments to enlarge text and simplify layouts.
- **Bilingual Support**: UI accommodates varying text lengths between English and Hindi strings (defined in `backend/lib/i18n.json`).
