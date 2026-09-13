# Ripple Recycling — landing page

A static, dependency-free landing page built as a conversion funnel:
first impression → hero → trust → positioning → process → offer → industries →
proof → social proof → objection removal → pricing → FAQ → booking.

```
index.html          the full homepage
assets/styles.css   design tokens + component language
assets/main.js      nav state, scroll reveals, gallery pagination, form fallback
```

Open `index.html` in a browser, or serve it with `python3 -m http.server`.

## Design system

Tokens live at the top of `assets/styles.css` as CSS custom properties —
colour, type scale, spacing, radii. The system is near-monochrome: ink on
alternating `#ffffff` / `#f5f5f7` bands, 28px card radii, pill buttons, no
shadows. `#0071e3` is reserved for filled CTAs and `#0066cc` for inline links.
Colour enters only through the finish surfaces (`.finish--citrus`, `--sky`,
`--starlight`, `--silver`, `--indigo`, `--midnight`) used on the industry,
results and pricing cards.

Type is Inter, loaded from Google Fonts as the SF Pro substitute. Swap the
`<link>` and `--font-display` / `--font-text` if you license something else.

## Before this goes live

- [ ] **Wire up the audit form.** `assets/main.js` currently intercepts submit
      and shows a "not connected" message. Set `action` (and `method="post"`,
      `enctype="multipart/form-data"`) on the `<form data-audit-form>` in
      `index.html` to your handler — Tally, Formspree, Netlify Forms or your
      own endpoint — then delete the fallback block in `main.js`.
- [ ] **Replace the placeholder testimonials.** The three quotes in the social
      proof section are written to shape but are not real. Swap in genuine,
      permissioned client feedback and delete the `.placeholder-tag` spans.
- [ ] **Replace the Waste Wins figures.** The before/after numbers and the hero
      invoice are illustrative. Use real, client-approved results — with
      permission — and remove the "example figures" notes under each.
- [ ] **Publish the Insights articles.** The three cards link to `#audit` and
      say "Coming soon". Point each `href` at the real post as it goes live.
- [ ] **Check the small print** against how the business actually operates, and
      add company number, registered address and a privacy policy link to the
      footer.
- [ ] **Add real contact details** — the footer currently only routes to the
      audit form.
- [ ] Replace the placeholder ripple mark in the nav with the real logo, and
      add a favicon and an Open Graph share image.
