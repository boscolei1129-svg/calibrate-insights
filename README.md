# Calibrate

A private, static Instagram relationship explorer, built for GitHub Pages. No password, scraping, backend, account, analytics, or runtime dependencies.

## Use

1. In Instagram, go to Settings → Accounts Center → Your information and permissions → Export your information (or Download your information).
2. Select your Instagram account, Followers and following, **All time**, and JSON (recommended) or HTML. Export to your device.
3. Download and unzip the archive when it is ready. Find `connections/followers_and_following` (paths may vary).
4. Open Calibrate and select `following.json` plus **all** `followers_*.json` parts. Original HTML equivalents work too. You can add parts in a second selection. Same-named files replace earlier copies.
5. Explore Not following back, Mutuals, Fans, Followers, and Following. Search and sort, then Export CSV for the entire filtered category, across all pages.
6. Optionally add an older export, label both snapshot dates, and confirm they are complete and from the same account. Select a change category and export its CSV if useful.

Only usernames/profile links and list membership are available. This is not Instagram's professional analytics product: it does not report engagement, reach, visits, or people who view a profile.

## Privacy and correctness

- All selected files stay in tab memory. Refresh, closing the tab, or Clear all data discards the in-app lists.
- No localStorage, IndexedDB, cookies, remote fonts, external libraries, profile images, tracking pixels, or analytics.
- CSP blocks network connections, forms, and unapproved scripts. Opening an explicitly selected Instagram profile navigates to Instagram. GitHub may log normal page requests, including IP addresses; selected file contents are never uploaded.
- Untrusted HTML is never inserted into the document or parsed as a complete DOM. Only profile anchor attributes are read. Account names are validated and rendered with textContent. JSON is never executed.
- Import selections are atomic: an invalid file rejects the entire selection and retains the last valid snapshot. Results require both list types. Names are case-normalized and duplicates merged. A genuinely empty list is valid.
- Missing follower parts, limited date ranges, mixed accounts or mixed export dates cause incorrect results; the app cannot prove completeness or account ownership from relationship files alone.
- Historical comparisons are username set differences, **not proof of an unfollow**. Renames and deactivations can resemble removal; export dates are user-provided labels, not unfollow dates.
- CSVs contain private usernames. Keep downloaded exports and CSVs private. Never put them in the repository. Fixtures under tests are invented examples only.
- Unzip locally first; ZIP archives are not supported. Select only follower/following files, up to 50 MB each and 100 MB per selection. Large exports may take time to parse.

## Development

Requires Node.js 20 or newer; no packages to install.

```sh
node --test tests/data.test.mjs
node serve.mjs
```

Open http://127.0.0.1:4187. The local server binds only to loopback. The deployed app needs no server.

## GitHub Pages

Publish the app source in a dedicated repository. Under Settings → Pages, use Deploy from a branch → main → /(root). `index.html` uses relative URLs, so both project and user Pages paths work. `.nojekyll` skips Jekyll processing.

Site files: `index.html`, `styles.css`, `app.js`, `data.js`, `favicon.svg`, `.nojekyll`. Keep all private exports out of source control; `.gitignore` excludes common export filenames outside tests.

## Validation

The automated suite covers JSON variants, BOM, HTML profile links, mismatch rejection, split files, duplicates, empty snapshots, history direction, profile URL restrictions, CSV escaping, and 20,000-account parsing. Synthetic fixtures support end-to-end browser upload tests.

Independent tool; not affiliated with Instagram or Meta.
