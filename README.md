# SkyAgent — AI automation landing page

A production-quality marketing site for a fictional AI agent product, built with
Next.js 16 (App Router), TypeScript, Tailwind CSS v4 and Motion.

All branding, copy, icons and illustrations are original. Every product visual is
a real React component rather than a screenshot.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
npm run lint
```

## Architecture

```
app/
  layout.tsx            metadata, fonts, theme + dialog providers, JSON-LD
  page.tsx              section composition
  globals.css           design tokens, dark palette, utilities, keyframes
  icon.svg              favicon
  opengraph-image.tsx   generated OG image (twitter-image re-exports it)
  sitemap.ts robots.ts

components/
  announcement-bar navbar hero agent-preview trusted-by
  feature-section collaboration-demo integrations analytics-demo automation-demo
  testimonial how-it-works security pricing testimonials faq final-cta footer
  action-dialog theme-provider theme-toggle logo
  ui/  button eyebrow section-heading avatar reveal

hooks/use-reduced-motion.ts   hydration-safe prefers-reduced-motion
lib/  utils.ts site.ts faqs.ts
```

## Design system

Tokens live as CSS custom properties in `app/globals.css` and are exposed to
Tailwind through `@theme inline`, so utilities such as `bg-card`,
`text-muted-foreground` and `shadow-window` resolve in both themes.

- Light: near-white grounds, 1px low-contrast borders, restrained shadows.
- Dark: a dedicated palette (`#08090a` ground, `#111315` cards, 8% white borders)
  rather than an inversion.
- Type: Geist Sans and Geist Mono, self-hosted by `next/font`.
- Fluid heading scale via `--text-display`, `--text-h2`, `--text-h3`.

Theme choice is persisted by `next-themes` under the `skyagent-theme` key.

## Interactions

Everything on the page works: theme toggle, mobile drawer, monthly/yearly
pricing toggle with real price changes, FAQ accordion, draggable testimonial
carousel, analytics date-range control with per-range data, chart hover
read-outs, workflow node inspection, integration hover states, and an
accessible dialog behind every call to action (email validation, pending and
success states).

## Accessibility

Semantic landmarks, a skip link, visible focus rings, labelled controls,
`aria-expanded` accordions, a focus-trapped dialog with Escape to close, and
full `prefers-reduced-motion` support (animated demos render their finished
state). axe-core reports zero violations at 1440px and 390px in both themes.

## Notes

The static privacy policy that previously lived at the repository root is served
from `public/privacy-policy.html`.
