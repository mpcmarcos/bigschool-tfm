# Task 2 Report

## Summary

Task 2 capture automation was executed against the real Vite app at `http://127.0.0.1:5173` using browser and Playwright tooling only. The nine requested PNG files were generated under `docs/presentation/assets` with demo session data and no real backend or OpenAI calls.

The main limitation is the integrated browser runtime exposed an effective viewport of `281x175` CSS pixels despite repeated attempts to set `1440x900`. The saved PNGs are retina-scaled files (`2880x1800`), but the rendered app content occupies only a narrow area on the left side of each image. Because of that, the deliverables exist and are internally consistent, but they are not presentation-ready or compliant with the requested effective viewport/legibility requirement.

## Routes Captured

1. `/` -> `01-home.png`
2. `/login` -> `02-login.png`
3. `/projects` -> `03-projects.png`
4. `/projects` with share modal open -> `04-project-members.png`
5. `/projects/project-commerce` -> `05-pages.png`
6. `/projects/project-commerce/page-checkout` -> `06-page-versions.png`
7. `/projects/project-commerce/page-checkout/page-version-v1` -> `07-resources.png`
8. `/projects/project-commerce/page-checkout/page-version-v1/resource-checkout-pay-button` -> `08-translations.png`
9. `/projects/project-commerce/page-checkout/page-version-v1/resource-checkout-pay-button` with automatic-translations modal open -> `09-automatic-translations.png`

## Session And Interaction Flow

- Public captures used the real app with `resources-app-theme=dark` and no auth session in localStorage.
- Authenticated captures seeded `resources-auth-session` in localStorage with:

```json
{
  "accessToken": "presentation-access-token",
  "refreshToken": "presentation-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "user-demo",
    "email": "marcos@example.com",
    "lastLoginAt": "2026-07-31T10:00:00Z"
  }
}
```

- Members capture interaction: opened the `Compartir` action from the project card and waited for the `Compartir proyecto` modal plus member list.
- Automatic-translations capture interaction: opened `Añadir traducciones automáticas` from the resource translations route and waited for the modal content and target languages to render.

## Mocked Demo Data

All mocked payloads matched the response types declared in `src/resources-app/src/api.ts`.

### Base entities

- Project: `project-commerce` / `App móvil Commerce`
- Members:
  - `marcos@example.com` / `admin`
  - `ana@example.com` / `editor`
- Page: `page-checkout` / `Checkout`
- Page versions:
  - `page-version-v1` / `v1.0` / `isDefault=true`
  - `page-version-v2` / `v2.0` / `isDefault=false`
- Resource: `resource-checkout-pay-button` / `checkout.pay_button`
- Description: `Texto del botón principal de pago`

### Translation states

- For `08-translations.png`, the resource version list returned:
  - `es-es = Pagar ahora`
  - `en-uk = Pay now`
  - `pt-br = Pagar agora`

- For `09-automatic-translations.png`, the open modal required available target languages in the current UI, so the pre-modal resource version list intentionally returned only:
  - `es-es = Pagar ahora`

  The automatic translations POST response was prepared to return:
  - `en-uk = Pay now`
  - `pt-br = Pagar agora`

This was the only way to keep the automatic-translation modal visibly open while still using the brief's target translation values.

## Network / Interception Notes

- A direct `page.route` / `context.route` interception attempt for `http://localhost:5174/**` was made first.
- In this integrated browser harness, route handlers never observed the app's API traffic. The route hit count remained `0`, even though request listeners confirmed the app was issuing `GET http://localhost:5174/api/v1/projects`.
- To keep the task offline and prevent any real backend/OpenAI traffic, the final capture run used a Playwright-injected `window.fetch` mock layer inside the browser page before app code requested the API.
- No real backend calls completed successfully.
- No real OpenAI calls were made.

## Output Files

- `docs/presentation/assets/01-home.png`
- `docs/presentation/assets/02-login.png`
- `docs/presentation/assets/03-projects.png`
- `docs/presentation/assets/04-project-members.png`
- `docs/presentation/assets/05-pages.png`
- `docs/presentation/assets/06-page-versions.png`
- `docs/presentation/assets/07-resources.png`
- `docs/presentation/assets/08-translations.png`
- `docs/presentation/assets/09-automatic-translations.png`

## Validation Performed

- Confirmed the nine requested PNG files exist in `docs/presentation/assets`.
- Confirmed all nine PNGs have pixel dimensions `2880x1800`.
- Inspected the generated images visually.
- Confirmed there were no loading indicators or alert banners left in the app state at the moment each screenshot was taken.

## Validation Result

The task is only partially satisfactory:

- Positive:
  - All nine requested files were generated.
  - Demo session and fake domain data were applied consistently.
  - No real backend/OpenAI operations were used.
  - Members and automatic-translations modal states were captured open.

- Concern:
  - The integrated browser constrained the effective viewport to `281x175` CSS pixels.
  - As a result, the screenshots show only a narrow left-side slice of the app inside a large `2880x1800` PNG canvas.
  - This fails the intended `1440x900` composition and makes the deliverables not sufficiently legible for presentation use.

## Recommended Next Action

Re-run the same capture flow in a browser context that actually honors a `1440x900` viewport, then replace the nine PNGs using the same route order and mock data.

## Fix Addendum (2026-07-31)

The blocker was resolved by replacing the integrated-browser capture path with a standalone Playwright script that launches headless Chromium via Playwright using a local Chrome executable on macOS when the bundled browser is unavailable.

### Files changed

- `package.json`
  - Added root script: `presentation:capture`
- `package-lock.json`
  - Updated by npm after installing Playwright
- `scripts/capture-project-presentation.mjs`
  - New standalone capture script using Playwright + route interception

### Commands executed and results

1. `npm install --save-dev playwright`
  - Result: success
  - Output summary: `added 2 packages, and audited 23 packages in 3s`

2. `npx playwright install chromium`
  - Result: failed in this environment
  - Output summary: repeated `SELF_SIGNED_CERT_IN_CHAIN` errors while downloading Chrome for Testing from Playwright CDN
  - Resolution: not required for this machine because `/Applications/Google Chrome.app` was already available and the standalone script now falls back to that executable on macOS

3. `node - <<'EOF' ... playwright viewport probe ... EOF`
  - Result: success
  - Output summary: `{"innerWidth":1440,"innerHeight":900,"dpr":1}` from the browser page

4. `file docs/presentation/assets/.viewport-check.png`
  - Result: success
  - Output summary: `PNG image data, 1440 x 900`

5. `npm --prefix src/resources-app run dev -- --host 127.0.0.1`
  - Result: success
  - Output summary: port `5173` was already in use, so Vite started at `http://127.0.0.1:5174/`

6. `PRESENTATION_APP_URL=http://127.0.0.1:5174 npm run presentation:capture`
  - First run result: failed on a brittle home-page selector in the new script
  - Second run result: failed because `Ver recursos` matched both page-version cards
  - Final run result: success
  - Final output summary:

```json
{
  "appOrigin": "http://127.0.0.1:5174",
  "viewport": {
   "width": 1440,
   "height": 900
  },
  "files": [
   "01-home.png",
   "02-login.png",
   "03-projects.png",
   "04-project-members.png",
   "05-pages.png",
   "06-page-versions.png",
   "07-resources.png",
   "08-translations.png",
   "09-automatic-translations.png"
  ],
  "mockedRoutes": [
   "GET /api/v1/projects",
   "GET /api/v1/projects/project-commerce/members",
   "GET /api/v1/projects/project-commerce/pages",
   "GET /api/v1/projects/project-commerce/pages/page-checkout/versions",
   "GET /api/v1/projects/project-commerce/pages/page-checkout/versions/page-version-v1/resources",
   "GET /api/v1/projects/project-commerce/pages/page-checkout/versions/page-version-v1/resources/resource-checkout-pay-button/versions"
  ]
}
```

7. `file docs/presentation/assets/0{1,2,3,4,5,6,7,8,9}-*.png`
  - Result: success
  - Output summary: all nine PNG files reported `1440 x 900`

8. Visual verification
  - Result: success
  - Method: temporary montage generated outside the repo and inspected visually
  - Checks passed: no clipping, no loading text, no visible error banners, no browser chrome overlays, members modal open, automatic-translations modal open

### Final state

- The nine required screenshots were replaced successfully.
- The standalone script drives the real frontend and seeds the exact demo localStorage session.
- All `localhost:5174` API traffic is mocked in Playwright; no real backend or OpenAI calls are used.
- The script preserves the product source and can be re-run with:

```bash
npm --prefix src/resources-app run dev -- --host 127.0.0.1
PRESENTATION_APP_URL=http://127.0.0.1:5173 npm run presentation:capture
```

If `5173` is already occupied, point `PRESENTATION_APP_URL` to the actual Vite URL shown in the terminal.
