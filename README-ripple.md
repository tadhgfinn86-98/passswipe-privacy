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
colour, type scale, spacing, radii.

The palette is two values: `#ffffff` and `#232323`. Nothing else on the page
is a colour — where hierarchy needs a softer step (secondary copy, hairlines,
input fills) it is one of those two at reduced strength over the other, which
stays neutral. There is no third hue anywhere.

Rhythm comes from tonal inversion. `.surface-light` and `.surface-dark` each
define four tokens — `--fg`, `--fg-2`, `--fg-3`, `--rule` (plus `--wash`) —
and every component reads those rather than a literal, so it works on either
ground without knowing which it is on. Bands alternate down the page, and a
card always carries the opposite tone to the band behind it. That is the only
mechanism: 28px radii, pill buttons, no shadows, no borders between sections.

To retone a section, swap its `surface-light` / `surface-dark` class and flip
its cards to match.

## The logo

The lockup is live text plus an inline SVG sprig (`.brand` in `index.html`,
used in the nav and the footer). The pale leaf and the wordmark take `--fg`,
so the mark inverts with whatever surface it sits on; the green leaf holds
`--brand-green` on both grounds. Add `brand--mono` to the lockup to drop the
green and render it in the two-value palette.

**Two things here are approximations, and both are one-line swaps:**

- **The wordmark is set in Inter**, not the real logo typeface. The supplied
  logo uses a rounded geometric sans with wider bowls and a distinctive
  horizontal-bar "e". Replace the `.brand` markup with the real logo SVG when
  you have the vector file, or add the licensed face and point
  `--font-display` at it.
- **`--brand-green` is `#0DB95E`**, estimated by eye from the supplied image.
  Set the exact value from your brand file — it is declared once, at the top
  of `assets/styles.css`, and used only by the logo.

The favicon is an inline data-URI of the same two leaf paths, in `index.html`.

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
- [ ] **Swap in the real logo.** The mark is rebuilt from the image you sent:
      the wordmark is Inter rather than the licensed face, and `--brand-green`
      is estimated. Drop in the vector file and the exact green.
- [ ] Add an Open Graph share image.
