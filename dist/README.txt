Mahmood Sahebi Portfolio — Cloudflare Pages static site

Deploy: upload the contents of this dist folder to Cloudflare Pages, or set dist as the build output directory.
Pages: index.html (Contact), about.html, expertise.html, experience.html, projects.html, resume.html (sample CV page).
Shared assets: assets/css/style.css and assets/js/app.js.

Vazirmatn:
- The CSS attempts to load a local variable font at assets/fonts/Vazirmatn-wght.woff2 first, then falls back to the Vazirmatn Google Fonts CDN.
- The binary font could not be downloaded in this environment because external network access was unavailable. Put the official Vazirmatn variable WOFF2 file at assets/fonts/Vazirmatn-wght.woff2 to enable the local fallback. CDN remains configured.

Security notes:
- _headers configures CSP and standard security headers. Review CSP if adding analytics, embeds, or external resources.
- Right-click, image dragging and common Ctrl/Cmd+S / Ctrl/Cmd+U shortcuts are deterred in JavaScript but cannot be reliably blocked. Screenshots and source saving cannot be prevented by a normal website.
- No server-side form, authentication, API keys or database are included. Never place secrets in client-side files.
- Contact email is the placeholder asghar.network@example.com and must be replaced with the real public contact address before publishing.
- The SVG profile asset is a placeholder mark, not a real portrait. Replace assets/images/profile-placeholder.svg with a licensed profile image and update the img path if needed.
- Review all translations and employer/experience details before publication; the six available languages are English, Persian, Dutch, German, Austrian German, and Hindi. Automatic external translation is not used.

Design update: warm cream-and-teal editorial theme based on supplied reference; light/dark toggle; slow first-load reveal; animated number counters; English is the initial language for first-time visitors; the selected language is saved and reused across pages; smooth scrolling.

Contact page includes LinkedIn and CV cards. Review resume.html carefully: dates are placeholders and the contact email is not yet real. Replace sample details before publishing.

PROFILE PHOTO: To replace the contact-page portrait, put your photo in dist/assets/images/ and name it profile.webp. Any normal portrait dimensions are supported; the page crops it neatly to fit the fixed responsive frame. If profile.webp is missing, the SVG placeholder is shown.


PRIVATE ADMIN CMS SETUP (Cloudflare Pages + D1)
================================================
Admin page: /admin.html (the file is separate from the public pages).
It manages Experiences and Projects. Each entry supports title, company/category, date, description, bullet points, tags, and an image URL/path. The public Experience and Projects pages load saved entries from the API when content exists; otherwise the original static entries remain visible.

IMPORTANT: A secure admin needs Cloudflare Pages Functions, a D1 database, and server-side secrets. Merely uploading this folder as static assets will NOT activate login or saving. Do not publish until setup is complete.

1) Create a Cloudflare D1 database named mahmood-portfolio-content.
2) Replace database_id in wrangler.toml with the ID from Cloudflare. Bind it as PORTFOLIO_DB in Pages > Settings > Functions > D1 database bindings (or deploy with Wrangler config).
3) Apply migration: npx wrangler d1 migrations apply mahmood-portfolio-content --remote --config wrangler.toml
4) Deploy this project as a Cloudflare Pages project with Functions enabled (uploading only static assets does not deploy the functions). For Git deployment, set the project root to the folder containing wrangler.toml and functions/, and set build output directory to dist. The functions/ folder must be at project root, not inside dist/.
5) In Pages > Settings > Variables and Secrets, set ADMIN_PASSWORD to a strong unique password and ADMIN_TOKEN_SECRET to a long random secret (at least 32 random bytes). Keep both server-side secrets; never put them in admin.js or HTML. Redeploy after configuring.
6) Open /admin.html and sign in. Changes are saved in D1 and shared to public visitors.

Security notes: Login tokens expire after 8 hours and are kept in sessionStorage. Use HTTPS, a strong password, and Cloudflare rate limiting/WAF rules for /api/admin/login. This CMS currently supports content entries for Experiences and Projects; it does not yet provide editing for every text block on About, Expertise, Contact, or Resume. Image fields accept a URL/path; binary image upload storage is not configured.

PERSIAN DEPLOYMENT GUIDE
========================
See ../README-FA.txt for the Cloudflare Pages + Functions + D1 setup instructions in Persian. The site requires Cloudflare configuration (D1 binding and server-side Secrets) for secure shared editing; static drag-and-drop alone cannot activate the CMS.
