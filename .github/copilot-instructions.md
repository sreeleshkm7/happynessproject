# HappynessProject Project Guidelines

## Architecture
- This is a static, multi-page HTML/CSS/vanilla-JavaScript site; keep existing visual design and page layouts unchanged.
- Keep scripts compatible with classic browser scripts and the existing shared header, profile popup, toast, and route helpers.
- Supabase is the backend. Keep all database and Storage operations in `js/api.js`; keep schema changes in numbered `supabase/migrations/` SQL files and seed data in `supabase/seed.sql`.
- Load the pinned Supabase JavaScript v2 UMD client before the shared configuration, client, API, and application scripts.

## Security and Data
- Only the Supabase project URL and anon/public key may be used by frontend code. Never add service-role keys or database passwords to frontend code or git.
- Enable RLS and define explicit least-privilege policies for every table. Enforce prices, seat counts, booking status, and roles on the server.
- Handle Supabase operations asynchronously with errors surfaced through the existing user-facing toast patterns; preserve loading and empty states.
- Render database-provided text safely with `textContent` or escaped HTML. Never interpolate untrusted database values into raw HTML.
- Do not store full payment-card numbers or CVVs.

## Workflow
- Work one requested phase at a time. Summarize changed files and verification steps, then stop until the user says `continue`.
- Read each file before editing it. Preserve unrelated work and ask for approval before deleting files.
- Never change page copy, colors, fonts, layout, or other visual design unless explicitly requested.
- Do not commit secrets, `.env` files, `node_modules`, OS metadata, or local build/deployment artifacts.

## Validation
- Run the relevant static-site link/asset audit and focused checks for each phase. For database work, provide the exact SQL Editor run order and manual dashboard steps.
