# Cloudflare Pages Frontend Deployment

The frontend is configured as a static Next.js export. Cloudflare Pages can serve the generated `out` directory directly.

## Cloudflare Pages Settings

Use these settings when importing the GitHub repository:

```text
Framework preset: Next.js (Static HTML Export)
Root directory: frontend
Build command: npm run build
Build output directory: out
```

Set this environment variable in Cloudflare Pages:

```text
NEXT_PUBLIC_API_URL=https://aaaaasssss.pythonanywhere.com/api
```

## Local verification

```bash
cd frontend
npm run typecheck
npm run build
```

After `npm run build`, Next.js writes the static site to:

```text
frontend/out
```

## Backend CORS

After Cloudflare gives you a `*.pages.dev` domain or you attach a custom domain, add that frontend origin to Django:

```env
CORS_ALLOWED_ORIGINS=https://YOUR_PROJECT.pages.dev,https://YOUR_CUSTOM_DOMAIN
CSRF_TRUSTED_ORIGINS=https://YOUR_PROJECT.pages.dev,https://YOUR_CUSTOM_DOMAIN
FRONTEND_URL=https://YOUR_PROJECT.pages.dev/
```

Then reload the PythonAnywhere web app.
