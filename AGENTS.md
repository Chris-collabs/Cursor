# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

**Näringskollen** is a static Swedish nutrition explorer under `slv-naring/`. It uses vanilla HTML/CSS/JS (ES modules) with **no build step**, **no `package.json`**, and **no backend in this repo**. Data comes from the public [Livsmedelsverket dataportal API](https://dataportal.livsmedelsverket.se/livsmedel); the diary persists in browser `localStorage` only.

### Services

| Service | Required | How to run |
|---------|----------|------------|
| Static HTTP server | Yes | ES modules need HTTP (not `file://`). From repo root: `python3 -m http.server 8080` |
| Livsmedelsverket API | Yes | External HTTPS; needs outbound internet from the browser |
| npm / Docker / DB | No | Not used |

App URL (local): `http://127.0.0.1:8080/slv-naring/` (root `index.html` redirects here).

### Lint / test / build

There is no project-level linter, test runner, or build command in this repository. CI (`.github/workflows/pages.yml`) only uploads static files to GitHub Pages.

### Development workflow

1. Start a static server from the **repository root** (not only inside `slv-naring/`), so `/slv-naring/` resolves correctly.
2. Open the app in a browser with network access.
3. Smoke test: wait for food count → search (e.g. `havregryn`) → select item → nutrients panel → optional “Lägg till i dagbok”.

### Gotchas

- Serving only `slv-naring/` as the server root breaks the redirect from `/` and may confuse relative paths; prefer serving `/workspace`.
- If the food list stays on “Startar…” or search stays disabled, check browser console for CORS/network errors to `dataportal.livsmedelsverket.se`.
