---
name: Ethika Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#3e2400'
  on-tertiary: '#ffffff'
  tertiary-container: '#5c3800'
  on-tertiary-container: '#ef9900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 48px
  display-lg-mobile:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  table-cell-padding: 12px 16px
---

## Brand & Style
The design system is engineered for high-stakes financial environments, prioritizing clarity, precision, and a sense of institutional stability. The brand personality is **Professional, Trustworthy, and Methodical**. It serves accountants, financial controllers, and business owners who require a tool that feels like a reliable partner rather than a complex hurdle.

The visual style is **Corporate Modern**, drawing heavily from systematic design principles. It utilizes a structured hierarchy, ample whitespace to reduce cognitive load during data entry, and a refined "low-noise" aesthetic. The interface is optimized for Right-to-Left (RTL) reading patterns, ensuring that the visual weight and flow feel natural for Arabic-speaking users.

## Colors
This design system utilizes a palette rooted in "Deep Professional Blue" to evoke authority and security. 

- **Primary Blue (#1E3A8A):** Used for primary actions, navigation headers, and brand-critical elements.
- **Secondary Emerald (#10B981):** Symbolizes growth and financial health; reserved for "Success" states and positive financial trends.
- **Functional Accents:** Amber (#F59E0B) is used for pending items or warnings, while Rose (#EF4444) is strictly for overdue invoices or critical errors.
- **Neutrals:** A range of cool grays provides soft contrast for backgrounds and borders, ensuring that data-heavy tables remain legible and easy on the eyes over long working sessions.

## Typography
The typography system uses **IBM Plex Sans Arabic** for its exceptional legibility in technical contexts. It strikes a balance between traditional calligraphic roots and modern engineering.

- **Numerics:** While the UI uses Arabic script, financial figures should remain highly legible. For data tables and balance sheets, a monospaced font (JetBrains Mono) is introduced to ensure that decimals and digits align vertically, facilitating quick scanning of columns.
- **Hierarchy:** Bold weights are reserved for page titles and summary totals. Regular weights are used for the bulk of ledger entries to prevent visual fatigue.
- **RTL Considerations:** Line heights are slightly increased compared to Latin standards to accommodate the vertical extensions of Arabic glyphs.

## Layout & Spacing
The system employs a **Fixed Grid** on desktop (12-column) and a **Fluid Grid** on mobile. 

- **RTL Layout:** All layouts must be mirrored. The sidebar resides on the right, and the main content flows to the left. Progress bars and charts must fill from right to left.
- **Spacing Rhythm:** An 8px linear scale (with 4px increments for tight components) is used. 
- **Density:** High-density layouts are permitted for data tables to maximize information density, while dashboards use generous 32px margins to create a sense of executive clarity.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. This maintains a clean, "paper-like" professional feel.

- **Level 0 (Background):** #F9FAFB (The canvas).
- **Level 1 (Cards/Tables):** White (#FFFFFF) with a 1px border in #E2E8F0. No shadow.
- **Level 2 (Dropdowns/Modals):** White with a soft, 10% opacity Deep Blue shadow (0px 4px 12px) to lift it from the work surface.
- **Interactive Depth:** Buttons use a subtle inner-glow on hover to simulate being "pressed" into the page.

## Shapes
This design system uses a **Soft** shape language. 

- **Standard Radius (4px):** Applied to buttons, input fields, and checkboxes. This subtle rounding maintains a professional "sharpness" while feeling modern.
- **Large Radius (8px):** Used for cards and main container wrappers.
- **Status Pills:** Use a full "pill" radius (999px) to clearly differentiate status indicators (Paid, Pending) from interactive buttons.

## Components
- **Data Tables:** The core of the system. Use a "Zebra" striping pattern every second row (#F8FAFC). Headers are sticky, using a semi-bold weight and a subtle bottom border.
- **Status Chips:** Small, high-contrast pills. "Paid" uses an Emerald background (10% opacity) with Emerald text. "Overdue" uses Rose.
- **Primary Buttons:** Solid Deep Blue (#1E3A8A) with white text. Iconography (e.g., "Add Invoice") should be placed to the right of the text label for RTL flow.
- **Input Fields:** Use a 1px #CBD5E1 border. Labels are always top-aligned and right-justified.
- **Financial Charts:** Line charts should use a 2px stroke width. Bar charts for "Revenue vs Expense" should use the Primary Blue and Secondary Emerald respectively.
- **Empty States:** Use simplified line illustrations with a gray scale to guide the user back to the primary action (e.g., "Create your first invoice").