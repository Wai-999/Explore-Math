# GitHub Pages deployment

Repository: `https://github.com/Wai-999/Explore-Math`.

The owner authorized preview publication with human reviews pending, then explicitly requested execution and deployment of the six-world prompt on October 26, 2026. The next preview is `0.4.0-preview.1`. This does not record completed mathematics, novice or accessibility review. The app retains its preview disclosure. See [the applied-world release record](applied-worlds/RELEASE_NOTES.md); prior V2 evidence remains in [PR #2](https://github.com/Wai-999/Explore-Math/pull/2).

Push the tested feature branch, open a PR, wait for required checks, and merge through repository policy. Main pushes run the existing Pages workflow. Do not change repository settings or bypass protection. Claim deployment only after that workflow succeeds and actual public browser journeys pass; record the commit/run links in the PR handoff.

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
