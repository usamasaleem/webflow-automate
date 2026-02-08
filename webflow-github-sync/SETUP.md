# Webflow → GitHub Sync - Setup Guide

Complete setup instructions for the automated Webflow to GitHub sync system.

## Prerequisites

- **Node.js 18+** - [nodejs.org](https://nodejs.org)
- **Cloudflare account** - [cloudflare.com](https://cloudflare.com)
- **GitHub account** - [github.com](https://github.com)
- **Webflow site** - Published and publicly accessible

## 1. Clone and Install

```bash
git clone <your-repository-url>
cd webflow-github-sync
npm run setup
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required - Your published Webflow site URL
WEBFLOW_SITE_URL=https://yoursite.webflow.io

# Optional - For local testing only
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=username/webflow-project
```

**Important:** Never commit `.env` - it's in `.gitignore`.

## 3. Cloudflare Worker Setup

### Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
wrangler login
```

### Configure Worker

Edit `worker/wrangler.toml` if needed. The `name` and `compatibility_date` are pre-configured.

### Set Secrets

Secrets are required for the Worker to trigger GitHub Actions:

```bash
cd worker

# GitHub Personal Access Token (needs repo scope)
wrangler secret put GITHUB_TOKEN

# GitHub repository (format: username/repo-name)
wrangler secret put GITHUB_REPO
```

**GitHub Token Permissions:**
- Create a Personal Access Token at: GitHub → Settings → Developer settings → Personal access tokens
- Required scope: `repo` (full control of private repositories)

### Deploy Worker

```bash
npm run worker:deploy
# or: cd worker && wrangler deploy
```

After deployment, note your Worker URL (e.g., `https://webflow-webhook.<your-subdomain>.workers.dev`).

## 4. GitHub Configuration

### Repository Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret | Description | Required |
|--------|-------------|----------|
| `WEBFLOW_SITE_URL` | Your Webflow site URL (e.g., `https://yoursite.webflow.io`) | Yes |
| `GITHUB_TOKEN` | Default - already exists for Actions | Auto |

### Verify Workflow

The workflow file is at `.github/workflows/webflow-sync.yml`. It triggers on:

1. **repository_dispatch** - From Cloudflare Worker when Webflow publishes
2. **schedule** - Every 6 hours (backup sync)
3. **workflow_dispatch** - Manual run from Actions tab

## 5. Webflow Webhook Setup

1. Log in to [Webflow](https://webflow.com)
2. Select your site → **Project Settings** → **Integrations** → **Webhooks**
3. Click **Add Webhook**
4. Configure:
   - **Name:** GitHub Sync
   - **URL:** `https://webflow-webhook.<your-subdomain>.workers.dev/webhook/webflow`
   - **Events:** Site published, Site unpublished

5. Save the webhook

**Verify:** Publish your site and check GitHub Actions for a new run.

## 6. Testing

### Local Scraper Test

```bash
export WEBFLOW_SITE_URL=https://yoursite.webflow.io
npm run sync
```

Expected output: Performance report with timing breakdown.

### Full Re-scrape Test

```bash
npm run sync:full
```

### Worker Health Check

```bash
curl https://webflow-webhook.<your-subdomain>.workers.dev/health
```

Expected: `{"status":"ok","service":"webflow-webhook",...}`

### Manual Workflow Trigger

1. Go to **GitHub → Actions → Webflow Sync**
2. Click **Run workflow**
3. Optional: Check "Force full re-scrape"
4. Click **Run workflow** button

## 7. Common Issues

### Worker returns 500 "Server configuration error"
**Cause:** Missing `GITHUB_TOKEN` or `GITHUB_REPO` secrets  
**Fix:** Run `wrangler secret put GITHUB_TOKEN` and `wrangler secret put GITHUB_REPO`

### GitHub Actions fails with "WEBFLOW_SITE_URL secret is not set"
**Cause:** Repository secret not configured  
**Fix:** Add `WEBFLOW_SITE_URL` in Settings → Secrets and variables → Actions

### Scraper fails with "Failed to fetch homepage"
**Cause:** Site URL inaccessible or incorrect  
**Fix:** 
- Ensure URL uses `https://`
- Verify site is published (not draft)
- Test URL in browser - must load without authentication

### Webhook doesn't trigger GitHub Actions
**Cause:** Incorrect Worker URL or GitHub API permissions  
**Fix:**
- Verify Webflow webhook URL matches deployed Worker
- Check token has `repo` scope
- Test: `curl -X POST https://your-worker.workers.dev/webhook/webflow -H "Content-Type: application/json" -d '{}'`

### No changes committed
**Cause:** No files actually changed - expected behavior  
**Fix:** The scraper correctly skips unchanged content. Use manual "Force full re-scrape" to test.

## 8. Security Notes

- **Never** commit `.env` or tokens to the repository
- Use GitHub's built-in `GITHUB_TOKEN` where possible
- Cloudflare secrets are encrypted - use `wrangler secret` for sensitive values
- Webhook endpoint is public - consider adding signature verification for production

## 9. Deployment Checklist

- [ ] Node.js 18+ installed
- [ ] `.env` configured with `WEBFLOW_SITE_URL`
- [ ] Cloudflare Worker deployed
- [ ] Worker secrets set (`GITHUB_TOKEN`, `GITHUB_REPO`)
- [ ] GitHub repository secret `WEBFLOW_SITE_URL` added
- [ ] Webflow webhook configured with Worker URL
- [ ] Test: Publish Webflow site → Check GitHub Actions run
- [ ] Test: Manual workflow run from Actions tab
