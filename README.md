# Pattabhi Sports Club Dashboard

Club dashboard for students, coaches, batches, attendance, fees, and expenses. Works in any modern browser on phone, tablet, or laptop, and can be installed to a home screen.

## Run it

Needs Node.js 22.13 or newer.

```bash
npm install --prefix client      # first time only
npm run build                    # builds the React app into client/dist
npm start
```

Open http://localhost:3000. The data is stored in `data/psc.db`. Set `PSC_DATA` to keep it elsewhere and `PORT` to change the port.

For development with hot reload, run `npm start` in one terminal and `npm run dev` in another, then open the Vite address it prints. Vite forwards `/api` to the server on port 3000.

## Structure

- `server.js`: Node server. REST API, login check, and serves `client/dist`.
- `client/`: React app (Vite). `src/views` holds the six screens, `src/components` the shared pieces, `src/styles.css` the design tokens.
- Animation: GSAP for page and list motion, Rive for the loading animation when `client/public/animations/loader.riv` exists, and three.js for the WebGL ball shown on the loading screen when it doesn't.

## Use it from anywhere

Deploy it on any host that runs Node (Render, Railway, a VPS, and similar) and attach a persistent disk for `PSC_DATA`. There is no login at the moment, so only run it on a network you trust, and put it behind a login before anyone outside the club can reach it.

To install on a phone, open the site and choose "Add to Home Screen". On a laptop, use the install icon in Chrome or Edge.

## What's in it

- **Home:** this month's totals, today's attendance, pending fees, and who was absent today. Each pending fee and absence has a WhatsApp button with a ready message.
- **Students:** profiles with parent contact, batch, discount, and medical notes.
- **Attendance:** mark students or coaches present, late, or absent for any date.
- **Fees:** monthly billing from each batch's fee less any discount, with payments recorded against the month they cover.
- **Finance:** fees received, expenses by category, and net for the month.
- **Setup:** coaches and batches.

## Notes

- WhatsApp buttons open a chat with the message filled in. The sender taps send. This needs no API account. Automatic sending needs the WhatsApp Business Cloud API, which is a later step.
- Phone numbers without a country code are treated as Indian (+91).
- Deleting a payment or expense is permanent. Students, coaches, and batches are deactivated rather than deleted, so history stays intact.
- Back up `data/psc.db` regularly. It is one file.
