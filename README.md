# Kept

A self-care and executive function app where a customisable domme assigns your routine, checks in on you, and grants privileges. Instead of caring for a pet, you're the one being looked after.

## Features

- **Morning check-in** for mood and energy. A low day turns on burnout mode by itself.
- **Burnout mode** cuts the list to essentials and softens her tone at any intensity.
- **Daily orders**: morning, day and evening routines, each worth devotion points.
- **Her persona**: name, style (strict governess, nurturing mommy, cool executive, playful tease), and intensity from 1 to 5.
- **Journal** with prompts in her voice and replies that respond to what you write.
- **Privileges**: rewards you define and spend devotion on.
- **Standing** grows from New to Hers and never goes down. No streaks.
- **Data export** as JSON, ready for a future link with Ledger.

## Running it

Static files only, no build step. Deploy the repo root to Vercel (or any static host) and open it on your phone, then use "Add to Home Screen" to install it.

Data is stored in the browser's localStorage on each device. Use **Her → Copy my data / Paste data** to move it between devices.

## Reminders

She sends push notifications at your check-in time, your evening report time, and any order with a "Remind me at" time. A reminder is skipped when it's already done. At firm or stricter intensity she follows up once an hour later. On burnout days she only chases essentials.

How it works:

- `api/sync` stores your reminder schedule, persona and today's progress whenever the app changes.
- `api/tick` sends whatever is due. A GitHub Action (`.github/workflows/remind.yml`) calls it every 10 minutes.
- Push keys are generated on first use and kept in Redis. No secrets to set.

One-time setup: in the Vercel project, open **Storage → Create Database → Upstash for Redis** (free tier), connect it to `kept`, then redeploy. On iPhone, add Kept to the Home Screen and open it from there before turning reminders on.

## Files

- `index.html`: the whole app
- `manifest.webmanifest`, `sw.js`, `icon-*`: PWA install, offline support and notifications
- `api/`: reminder functions on Vercel
