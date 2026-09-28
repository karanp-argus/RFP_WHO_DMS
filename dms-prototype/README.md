# dms-prototype

The application for the WHO Health Accounts DMS prototype (RFP PFD-2026-001). The documentation
lives one level up — start with **[../README.md](../README.md)**, and read
**[../CLAUDE.md](../CLAUDE.md)** before changing any code.

```bash
npm ci
npm run dev              # http://localhost:5173
npx tsc -b               # typecheck
npm test                 # unit tests
npm run build            # production build
npm run audit:contrast   # WCAG gate, after any change to src/styles/globals.css
npm run audit:bundle     # critical-path gate, after a build
npm run serve:dist       # serve the build for a demo — http://localhost:4173
```

Before touching `package.json`, read [../DEPENDENCIES.md](../DEPENDENCIES.md). Every dependency
change must be recorded there in the same change.
