# Nisim Asis Website asiseng.co.il

Hebrew, right-to-left website for Assis Engineering & Structures, showcasing construction supervision, cost estimates, home inspections, and projects.

Built with plain HTML, CSS, and JavaScript. No dependencies or build step required.

## Run locally

Open `index.html` in your browser, or serve the project with Python:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Files

- `index.html` — main page
- `styles.css` — styling and responsive layouts
- `script.js` — navigation, animations, accessibility, and privacy preferences
- `accessibility.html` and `privacy.html` — policy pages
- `assets/` — images and branding

Deploy by uploading the project files to any static website host.

## SEO and indexing after deployment

The homepage identifies ניסים עסיס / Nisim Asis in its title, main heading,
visible about text, and linked Person, Organization, WebSite, and WebPage
JSON-LD. Alternate spellings are included in the person's structured data.
Canonical URLs use `https://asiseng.co.il/`. Update those URLs, social image
URLs, `robots.txt`, and `sitemap.xml` together if the domain changes.

1. Upload the changed HTML files and the new `robots.txt` and `sitemap.xml` to
   the production site root. Check that each returns HTTP 200 publicly.
2. Keep one preferred HTTPS hostname. Configure permanent redirects from HTTP,
   the alternate www hostname, and `/index.html` to their canonical equivalents
   in the hosting provider. Canonical tags alone do not create redirects.
3. Verify the domain in Google Search Console using the verification record
   supplied by Google. Submit `https://asiseng.co.il/sitemap.xml`, then inspect
   the homepage URL, run the live test, and request indexing.
4. Ensure hosting/CDN bot protection allows Googlebot to retrieve the pages,
   CSS, images, robots file, and sitemap. Check Search Console for indexing
   exclusions or crawl errors; direct automated requests may be blocked by
   hosting even when ordinary browser visits work.
5. If the business is eligible, complete its Google Business Profile with its
   actual business details and this website. Link to the site from the owner's
   real business profiles using consistent Hebrew and English names.

Search Console verification and indexing requests require access to the owner's
Google account and DNS/hosting. There is no verification token in this repo.
These improvements help search engines understand and discover the site;
indexing and first-place rankings remain Google's decision and take time.
