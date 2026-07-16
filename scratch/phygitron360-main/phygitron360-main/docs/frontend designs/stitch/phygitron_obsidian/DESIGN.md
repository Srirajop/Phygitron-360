# Design System Strategy: The Intelligent Workspace

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Digital Curator."** 

In the high-stakes world of B2B HR, information density often leads to cognitive fatigue. This design system moves beyond the "standard SaaS dashboard" by treating data with editorial prestige. We are not building a database; we are building an intelligent environment. 

By leveraging **intentional asymmetry**, we break the rigid, "boxy" feel of traditional enterprise software. We use high-contrast typography scales and overlapping surfaces to create a sense of depth and momentum. The interface should feel like a premium physical workspace—open, quiet, and meticulously organized.

---

## 2. Colors & Surface Architecture
Our palette transitions from the clinical to the cinematic. We use a high-chroma primary purple against a clinical white base to signal authority and innovation.

### The "No-Line" Rule
**Borders are a design failure.** To achieve the premium aesthetic of Linear or Stripe, 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined through background color shifts.
*   **Surface (base):** `#f9f9f9`
*   **Surface-Container-Low:** Use `#f3f3f4` for secondary modules.
*   **Surface-Container-Lowest:** Use `#ffffff` for high-priority cards to create a "lifted" effect against the base.

### Surface Hierarchy & Nesting
Think of the UI as layers of fine paper. 
*   **Level 0:** `surface` (The desk)
*   **Level 1:** `surface_container_low` (The blotter)
*   **Level 2:** `surface_container_lowest` (The document)
By nesting `#ffffff` cards inside a `#f3f3f4` section, you create a natural, sophisticated hierarchy without a single line of CSS border.

### The "Glass & Gradient" Rule
To inject "soul" into the B2B experience:
*   **Signature Textures:** Use a subtle linear gradient for primary CTAs: `primary` (#5300d5) to `primary_container` (#6c27ff) at a 135-degree angle.
*   **Glassmorphism:** For floating navigation or modal overlays, use `surface_container_lowest` at 80% opacity with a `24px` backdrop-blur. This keeps the user grounded in their previous context.

---

## 3. Typography: Editorial Authority
We pair the geometric precision of **Manrope** for high-level branding with the functional clarity of **Inter** for data.

*   **Display & Headlines (Manrope):** Use `display-lg` (3.5rem) and `headline-lg` (2rem) with `-0.04em` letter spacing. These should always be `on_background` (#1a1c1c) and bold. This high contrast signals "The Intelligent Workspace."
*   **Body & Titles (Inter):** Use `body-md` (0.875rem) for standard UI text. Keep line heights generous (1.6) to allow the "lavender air" of the background to breathe through the text.
*   **Labels:** `label-sm` (0.6875rem) should be used in `on_surface_variant` (#494457) with `+0.05em` tracking for a technical, precise feel.

---

## 4. Elevation & Depth
We reject the heavy drop-shadows of the early web. Our depth is "Ambient."

*   **The Layering Principle:** Depth is achieved by stacking. A `surface_container_highest` element should only ever sit on a `surface_container` or lower.
*   **Ambient Shadows:** If a card requires a "float" (e.g., a hover state), use a multi-layered shadow:
    *   `0px 4px 20px rgba(108, 39, 255, 0.04)` (The Purple Tint)
    *   `0px 10px 40px rgba(0, 0, 0, 0.04)` (The Ambient Light)
*   **The Ghost Border Fallback:** If accessibility requires a stroke (e.g., input fields), use `outline_variant` at 20% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), `0.375rem` (md) radius, white text. No border.
*   **Secondary:** `surface_container_low` background with `primary` colored text. This feels integrated, not "pasted on."
*   **Tertiary:** Ghost style. No background, `0.5` opacity until hover.

### Input Fields
*   **Style:** `surface_container_lowest` background. 
*   **Focus State:** Shift background to `primary_fixed` (#e8ddff) with a 1px "Ghost Border" of `primary`. This provides a "soft glow" focus rather than a harsh outline.

### Cards & Lists
*   **Strict Rule:** No dividers. Separate list items using `1rem` (spacing scale 3) of vertical padding and a subtle `surface_container_low` background on hover.
*   **Geometric Accents:** Use 4px vertical "accent bars" in `primary` on the far left of an active list item to denote selection.

### Sophisticated HR Components
*   **The Talent Matrix:** A 2x2 grid using asymmetrical spacing. One quadrant should be 1.5x larger than the others to draw focus to "Top Performers."
*   **The Pulse Indicator:** A small, blurred `primary` orb that pulses subtly (2s ease-in-out) to indicate real-time data streaming.

---

## 6. Do's and Don'ts

### Do:
*   **Use the Spacing Scale religiously.** Use `8` (2.75rem) or `10` (3.5rem) for section margins. Space is your most expensive asset; use it.
*   **Mix Alignments.** Use left-aligned headlines with right-aligned data visualizations to create sophisticated asymmetrical tension.
*   **Tint your Grays.** Ensure all neutrals have a hint of purple (`#F3EFFF`) to maintain the "Intelligent" atmosphere.

### Don't:
*   **Never use pure #000000.** Use `on_background` (#1a1c1c) to keep the "Light" feel.
*   **No 90-degree corners.** Use the `md` (0.375rem) radius as the standard for all interactive elements to maintain the "Modern" softness.
*   **Avoid "System Blue."** All success states or links should lean into the `primary` purple or a sophisticated emerald; avoid the default SaaS blue at all costs.