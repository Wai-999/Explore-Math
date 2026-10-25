# GitHub Pages deployment

Repository: `https://github.com/Wai-999/Explore-Math`.

Prediction Studio `0.2.0-rc.1` is a review candidate on `feature/prediction-studio`. The public site remains v0.1. The user's predictive-modeling master prompt, section 7, requires the prior human usability gate before releasing additional mission families. Complete [the review package](review/PREDICTION_STUDIO_REVIEW.md), resolve material findings, and record the release decision before merging to main. Branch CI validates the candidate; it does not publish Pages. Do not dispatch the Pages workflow for this candidate while that gate is pending.

The app is built statically with default Vite base `/Explore-Math/`. `VITE_BASE_PATH` overrides it, e.g. `VITE_BASE_PATH=/ npm run build` for a user-root site. Hash routes work without server rewrites. All fonts, lazy chunks, equations, CSS, and geometry are local build assets.

The tracked Pages workflow builds on main pushes and manual dispatch, derives base from the repository name, uses official Pages actions, and grants only contents-read, pages-write, and id-token-write. CI separately runs browser journeys on Chromium, Firefox, and WebKit. No token belongs in source or frontend environment variables.

If Pages is not enabled, an administrator must select **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun **Deploy to GitHub Pages**. Terminal pushes require a working Git transport credential; creating a pull request through the connected GitHub plugin does not require a separate CLI login. No account settings or branch protections should be bypassed.

```sh
npm ci
npm run build
npm run preview -- --port 4174
```

Test the printed `/Explore-Math/` URL and refresh `/#/explore/calculus`. A deployment is only claimed after a green workflow AND successful live scene interaction. The intended URL, until verified, is `https://wai-999.github.io/Explore-Math/`.

Rollback by reverting the faulty application commit on main; the workflow deploys the previous source again. Local screenshots and automated browser output are excluded from Git unless deliberately selected for documentation.
