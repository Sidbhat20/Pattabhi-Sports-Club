# Design: Scoresheet

Visual world for the Pattabhi Sports Club admin. The world is a match scoresheet: a dense, ruled ledger on a work surface, with the club's colours used only for function.

## Colour

| Token | Value | Use |
|---|---|---|
| `--rail` | `#2c2c2c` | Navigation rail (charcoal, from the logo) |
| `--rail-text` | `#e9e7e2` | Rail labels |
| `--surface` | `#f4f4f2` | Page background, cool neutral |
| `--panel` | `#ffffff` | Tables, forms, dialogs |
| `--rule` | `#dcdcd8` | Table rules, input borders |
| `--ink` | `#1f1f1d` | Primary text |
| `--ink-2` | `#5f5f5a` | Secondary text, tinted toward the neutral |
| `--maroon` | `#9c242c` | Current nav item, primary action, due amounts, focus |
| `--maroon-deep` | `#7a1c23` | Hover on maroon |
| `--orange` | `#ec7c1c` | Late state only |
| `--yellow` | `#fcec04` | Logo only; never in the UI |

Restrained colour: maroon marks what needs action or where you are. Nothing is decorative.

## Type

One family, system sans (`Inter`, then the platform sans). Tabular figures on every money and count column.

- Scale (rem, 1.2 steps): 0.75 caption, 0.8125 small, 0.875 body, 1 body-large, 1.25 page title.
- Weights: 400 body, 500 labels and table heads, 600 page titles and totals.
- Tracking: 0. Headings are sentence case.

## Layout

- Desktop: 232px charcoal rail on the left, content on `--surface` filling the rest. Content has a 24px gutter and no max width, because tables need the room.
- Phone (under 860px): the rail becomes a fixed bottom bar with text labels.
- Page structure: title and a one-line count summary, then the controls row, then the table or list.

## Components

- **Tables:** `--panel` surface, 12px radius, 1px `--rule` lines between rows, no zebra striping. Header row in 500 weight, small, `--ink-2`. Numeric columns right-aligned with tabular figures. On phones each row stacks into a labelled block.
- **Buttons:** 6px radius, 36px high. Primary: maroon fill, white text. Secondary: white with 1px rule. Tertiary: text only in `--ink-2`. WhatsApp is secondary with the same styling, not a brand green.
- **Segmented control:** the only control for mutually exclusive states (Present / Late / Absent, Students / Coaches, batch). Connected segments in one 1px-ruled group. The selected segment is charcoal (`--rail`) with white text. Maroon stays on the primary action.
- **Inputs:** 40px, 6px radius, 1px `--rule`, focus ring 2px maroon with 2px offset.
- **Status:** plain text with a small dot. Due: maroon text. Paid: `--ink-2`. Absent: maroon. Late: orange dot. No filled pills.
- **Dialogs:** native `<dialog>`, 12px radius, shadow `0 8px 24px rgba(0,0,0,0.12)`.
- **Empty states:** name what is missing and the next action ("No students in U13 yet. Add a student.").

## Motion

State only, 150–200ms ease-out. A saved row flashes its border maroon for 600ms. A toast slides up and fades. The loading screen plays the Rive animation if provided, otherwise the WebGL ball. No page-load choreography, no count-up numbers, no list stagger.

## Do

- Use tabular figures in every money and count column.
- Keep the same control for the same job on every screen.
- Show the count summary on each page (for example, "58 of 60 marked").

## Don't

- No hero-number cards, gradient text, glassmorphism, or decorative shadows.
- No pill chips for filters; use the segmented control.
- No cream or warm-paper surfaces.
- No second accent colour in the UI; orange appears only as the "late" dot.
