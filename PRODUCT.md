# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Recorded decision: React 19 with Vite for the client, Node.js (built-in `node:http` and `node:sqlite`) for the server and API. The user chose this stack on request. The stack is not a design constraint.

## Users

Club administrators of Pattabhi Sports Club: the owner, the office, and the caretaker. They run the club day to day: mark attendance at the court, record fee payments, chase pending fees over WhatsApp, and check monthly money. They use a phone at the ground and a laptop at the office. Coaches are not logged-in users. They are records the admin marks attendance for.

## Product Purpose

One place to run the club: student and coach records, batches, daily attendance, monthly fee collection, expenses, and a WhatsApp follow-up path for parents. Success means the admin can mark a full batch in under a minute and see who owes fees without opening a spreadsheet.

## Positioning

Built for one sports club's real workflow, with batch-level attendance and fee rules. It is not a general school or gym platform.

## Operating Context

- Attendance is taken on the court, often standing, on a phone, with many names to mark quickly.
- Fees are collected in person or by UPI, then recorded in the app.
- Reminders go out through WhatsApp, which opens a prefilled chat that the admin sends by hand. No automatic messaging yet.
- Monthly review happens on a laptop: money in, money out, who has not paid.

## Capabilities and Constraints

- Students (with batch, parent contact, discount, medical notes), coaches, batches (fee and coach), attendance for students and coaches, payments per student per month, expenses by category, WhatsApp `wa.me` links.
- Money is whole rupees (INR). Dates are `YYYY-MM-DD`, months are `YYYY-MM`.
- Login is a single shared username and password, through the browser's login prompt.
- Open decisions: batch fees, coach pay, batch schedules, and attendance history have not been provided. The current data is placeholder.

## Brand Commitments

- Name: Pattabhi Sports Club. The logo file says "Pattabhiramanagara Sports Club"; the owner has not yet confirmed which name the app should show.
- Colours (from the logo): maroon `#9c242c`, charcoal `#2c2c2c`, orange `#ec7c1c`, yellow `#fcec04`. These are binding.
- Logo: `client/public/logo.png` is binding.

## Evidence on Hand

- Logo PDF at `~/Downloads/PSC Logo.pdf`.
- Sample roster: 5 coaches (Sangeetha, Shridhar, Mahesh, Ranga, Anand Rao as caretaker), 4 batches (Juniors, U13, U16, U18), 60 students with placeholder names. Phone numbers are blank on purpose.
- No real attendance, fee, or payment records exist yet. Do not invent any in the UI.

## Product Principles

- The admin is standing at the court with a phone. Every common action is one or two taps.
- Show money and attendance as they are. No charts that flatter, no decorative numbers.
- The UI should disappear into the task. Consistency across screens beats novelty.
- Anything that can lose money or attendance history needs a clear, recoverable path.

## Accessibility & Inclusion

- Tap targets at least 44px on phones.
- Text contrast at least 4.5:1.
- Works in bright sunlight: no low-contrast grey on white for important numbers or status.
