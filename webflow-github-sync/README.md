# Webflow → GitHub Auto-Sync System

Automated workflow that syncs your Webflow site to GitHub every time you publish, with intelligent incremental scraping to avoid re-downloading unchanged pages.

## Features

- **Incremental scraping** - SHA-256 hashing and Last-Modified headers detect changed pages
- **Smart caching** - Skips unchanged pages (typically 80%+ faster on subsequent syncs)
- **Parallel asset fetching** - 5 concurrent requests for CSS/JS files
- **Webflow webhooks** - Cloudflare Worker receives publish events, triggers GitHub Actions
- **Zero external dependencies** - Built with Node.js built-ins only (https, fs, crypto, path)
- **Performance reporting** - Detailed timing breakdown and efficiency metrics

## Quick Start

```bash
# 1. Clone and setup
git clone <your-repo>
cd webflow-github-sync
npm run setup

# 2. Configure environment
cp .env.example .env
# Edit .env with your WEBFLOW_SITE_URL

# 3. Run first sync
npm run sync

# Force full re-scrape (ignore cache)
npm run sync:full
```

## Architecture

```
┌─────────────────┐     Webhook      ┌──────────────────────┐
│     Webflow     │ ───────────────► │  Cloudflare Worker   │
│  (Publish)      │                  │  /webhook/webflow    │
└─────────────────┘                  └──────────┬───────────┘
                                                │ repository_dispatch
                                                ▼
┌─────────────────┐                  ┌──────────────────────┐
│     GitHub      │ ◄─────────────── │   GitHub Actions     │
│   (Committed    │    git push      │   - Run scraper      │
│    content)     │                  │   - Commit changes   │
└─────────────────┘                  └──────────────────────┘
```

## Project Structure

```
webflow-github-sync/
├── package.json           # Root scripts
├── .env.example           # Environment template
├── worker/
│   ├── webhook-worker.js  # Cloudflare Worker (receives webhooks)
│   └── wrangler.toml      # Cloudflare config
├── sync-service/
│   └── incremental-scraper.js  # Smart scraper (main logic)
├── .github/workflows/
│   └── webflow-sync.yml   # GitHub Actions workflow
└── webflow-repo/          # Auto-generated output (committed)
    ├── html/
    ├── css/
    ├── js/
    └── metadata/
```

## Performance

| Scenario | Expected Time |
|----------|---------------|
| First sync (full) | 30-60 seconds |
| Incremental (no changes) | 5-15 seconds |
| Incremental (2-3 pages changed) | 10-20 seconds |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run sync` | Incremental sync (uses cache) |
| `npm run sync:full` | Full re-scrape (ignore cache) |
| `npm run worker:deploy` | Deploy Cloudflare Worker |
| `npm run worker:dev` | Local Worker development |

## Troubleshooting

### "WEBFLOW_SITE_URL is required"
Set the environment variable: `export WEBFLOW_SITE_URL=https://yoursite.webflow.io`  
Or add to `.env` file.

### "Failed to fetch homepage"
- Check the URL is correct and publicly accessible
- Ensure the site is published (not draft)
- Try with `https://` explicitly

### GitHub Actions not triggering
- Verify Cloudflare Worker secrets: `GITHUB_TOKEN` and `GITHUB_REPO`
- Check Webflow webhook URL points to your Worker
- Test manually: Actions → Webflow Sync → Run workflow

### No changes committed
- Scraper skips commit when no files changed (expected behavior)
- Use `sync:full` for manual workflow to force re-scrape

See [SETUP.md](SETUP.md) for detailed configuration instructions.
