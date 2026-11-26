# Paragon SEO release

Use the production URL-prefix property `https://paragon-system-gvlg.vercel.app/` for Search Console. The publication name is **Paragon - Cagayan State University Gonzaga**.

1. Apply the reviewed backend migration through the existing migration runner before releasing the new API. It backfills current article slugs. Redirect history accumulates from that point forward.
2. Release the API before the frontend. Verify the published article resolver, both sitemap counts, and one sitemap page against the target API. Configure the Vercel function's `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL` if the production addresses change.
3. On the deployed site, inspect the raw response for one published article and one issue. Expect HTTP 200, a visible headline and body or issue summary, one production canonical, and matching metadata. Check that styles, scripts and admin login still load. Verify a renamed published article returns 308, a missing URL returns 404, and private routes carry a noindex directive.
4. Check `/robots.txt`, `/sitemap.xml` and an article sitemap shard. Confirm previews are excluded and only published canonical URLs appear.
5. In Google Search Console, add the URL-prefix property and verify ownership with an available verification method. Submit `sitemap.xml`. Use URL Inspection on the published samples and check the selected canonical after Google recrawls them.
