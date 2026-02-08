#!/usr/bin/env node
/**
 * Intelligent Incremental Scraper for Webflow Sites
 * 
 * Uses SHA-256 hashing and Last-Modified headers to avoid re-downloading
 * unchanged pages. Extracts HTML, CSS, and JavaScript to webflow-repo/.
 * 
 * Node.js built-ins only: https, fs, path, crypto, url
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// Configuration
const CONCURRENT_ASSET_LIMIT = 5;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_INLINE_SCRIPT_LENGTH = 100;
const CDN_DOMAINS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'ajax.googleapis.com', 'code.jquery.com'];
const SYNC_HISTORY_MAX = 100;
// Script lives in sync-service/ so dirname is project root (webflow-github-sync)
const PROJECT_ROOT = path.dirname(path.resolve(__dirname));
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'webflow-repo');
const METADATA_DIR = path.join(OUTPUT_DIR, 'metadata');
const CACHE_FILE = path.join(METADATA_DIR, 'scrape-cache.json');
const LAST_SYNC_FILE = path.join(METADATA_DIR, 'last-sync.json');
const SYNC_HISTORY_FILE = path.join(METADATA_DIR, 'sync-history.json');

class IncrementalScraper {
  constructor(siteUrl, fullScrape = false) {
    this.siteUrl = this.normalizeUrl(siteUrl);
    this.baseUrl = new URL(this.siteUrl);
    this.fullScrape = fullScrape;
    this.cache = { assets: {} };
    this.timings = {};
    this.pagesScraped = 0;
    this.pagesSkipped = 0;
    this.filesUpdated = 0;
    this.inlineStyleCount = 0;
    this.inlineScriptCount = 0;
  }

  /**
   * Normalize URL - ensure https and no trailing slash for base
   */
  normalizeUrl(url) {
    let normalized = url.trim();
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }
    return normalized.replace(/\/$/, '') || normalized;
  }

  /**
   * Create SHA-256 hash of content for change detection
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Chunk array for parallel processing with concurrency limit
   */
  chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Fetch URL with redirect following, returns { body, headers, finalUrl }
   */
  async fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const protocol = parsed.protocol === 'https:' ? https : http;
      
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Webflow-GitHub-Sync/1.0',
          'Accept': options.accept || 'text/html,application/xhtml+xml,*/*;q=0.9',
          ...options.headers
        },
        timeout: 30000
      };

      const req = protocol.request(reqOptions, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          this.fetchUrl(redirectUrl, options).then(resolve).catch(reject);
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers = {};
          Object.keys(res.headers).forEach(k => {
            headers[k.toLowerCase()] = res.headers[k];
          });
          resolve({
            body,
            headers,
            statusCode: res.statusCode,
            finalUrl: res.responseUrl || url
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  /**
   * Make HEAD request to get Last-Modified header (quick change check)
   */
  async getLastModified(url) {
    try {
      const result = await this.fetchUrl(url, { method: 'HEAD' });
      return result.headers['last-modified'] || null;
    } catch {
      return null;
    }
  }

  /**
   * Load cache from disk
   */
  async loadCache() {
    try {
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      this.cache = JSON.parse(data);
      if (!this.cache.assets) this.cache.assets = {};
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('⚠ Could not load cache:', err.message);
      }
      this.cache = { assets: {} };
      return false;
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache() {
    await fs.mkdir(METADATA_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2));
  }

  /**
   * Determine which pages need scraping (incremental logic)
   */
  async determinePagesToScrape(links) {
    const pagesToScrape = [];
    const start = Date.now();

    for (const url of links) {
      // Normalize URL for cache key
      const cacheKey = this.normalizeCacheKey(url);
      
      // 1. Full scrape - scrape everything
      if (this.fullScrape) {
        pagesToScrape.push(url);
        continue;
      }

      // 2. Not in cache - need to scrape
      if (!this.cache[cacheKey]) {
        pagesToScrape.push(url);
        continue;
      }

      // 3. Cache too old - re-scrape
      const cacheAge = Date.now() - new Date(this.cache[cacheKey].timestamp).getTime();
      if (cacheAge > CACHE_MAX_AGE_MS) {
        pagesToScrape.push(url);
        continue;
      }

      // 4. Quick HEAD request for Last-Modified comparison
      const lastModified = await this.getLastModified(url);
      const cachedModified = this.cache[cacheKey].lastModified;
      
      if (lastModified !== cachedModified) {
        pagesToScrape.push(url);
      } else {
        this.pagesSkipped++;
      }
    }

    this.timings.changeAnalysis = Date.now() - start;
    return pagesToScrape;
  }

  normalizeCacheKey(url) {
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, '') || u.origin + '/';
    } catch {
      return url;
    }
  }

  /**
   * Extract internal links from HTML (same origin only)
   */
  extractInternalLinks(html, baseUrl) {
    const links = new Set();
    const base = new URL(baseUrl);
    
    // Match href="..." and href='...'
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const href = match[1].split('#')[0].split('?')[0].trim();
        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
          continue;
        }
        const fullUrl = new URL(href, baseUrl);
        // Same origin only
        if (fullUrl.origin === base.origin && fullUrl.pathname) {
          const path = fullUrl.pathname === '/' ? base.origin + '/' : fullUrl.origin + fullUrl.pathname.replace(/\/$/, '');
          links.add(path);
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return Array.from(links);
  }

  /**
   * Extract external CSS and JS URLs from HTML
   */
  extractAssets(html, baseUrl) {
    const assets = { css: [], js: [] };
    const base = new URL(baseUrl);

    // Link stylesheets
    const linkRegex = /<link[^>]+href\s*=\s*["']([^"']+\.css[^"']*)["'][^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const url = new URL(match[1], baseUrl).href;
        if (!this.isCdnUrl(url)) assets.css.push(url);
      } catch {}
    }

    // Script src
    const scriptRegex = /<script[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        const url = new URL(match[1], baseUrl).href;
        if (!this.isCdnUrl(url)) assets.js.push(url);
      } catch {}
    }

    return assets;
  }

  isCdnUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return CDN_DOMAINS.some(cdn => host.includes(cdn));
    } catch {
      return false;
    }
  }

  /**
   * Extract inline <style> blocks
   */
  extractInlineStyles(html) {
    const styles = [];
    const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content.length > 0) styles.push(content);
    }
    return styles;
  }

  /**
   * Extract inline <script> blocks (skip tiny ones < 100 chars)
   */
  extractInlineScripts(html) {
    const scripts = [];
    const regex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content.length >= MIN_INLINE_SCRIPT_LENGTH) scripts.push(content);
    }
    return scripts;
  }

  /**
   * Convert URL to safe filename
   */
  urlToFilename(url, ext = '.html') {
    try {
      const u = new URL(url);
      let name = u.pathname || 'index';
      if (name === '/' || name === '') name = 'index';
      name = name.replace(/^\//, '').replace(/\/$/, '') || 'index';
      name = name.replace(/\.html?$/i, '');
      name = name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return (name || 'index') + ext;
    } catch {
      return 'page' + Math.random().toString(36).slice(2) + ext;
    }
  }

  /**
   * Fetch and save a single page
   */
  async fetchPage(url) {
    const result = await this.fetchUrl(url);
    if (result.statusCode !== 200) {
      throw new Error(`HTTP ${result.statusCode} for ${url}`);
    }
    const html = result.body.toString('utf-8');
    const hash = this.hashContent(html);
    const lastModified = result.headers['last-modified'] || null;
    
    return {
      url,
      html,
      hash,
      lastModified,
      links: this.extractInternalLinks(html, url),
      assets: this.extractAssets(html, url),
      inlineStyles: this.extractInlineStyles(html),
      inlineScripts: this.extractInlineScripts(html)
    };
  }

  /**
   * Fetch asset (CSS or JS) - returns content or null
   */
  async fetchAsset(assetUrl) {
    try {
      const result = await this.fetchUrl(assetUrl);
      if (result.statusCode !== 200) return null;
      return {
        url: assetUrl,
        content: result.body.toString('utf-8'),
        size: result.body.length
      };
    } catch {
      return null;
    }
  }

  /**
   * Save HTML file
   */
  async saveHtml(filename, content) {
    const dir = path.join(OUTPUT_DIR, 'html');
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, content);
    this.filesUpdated++;
  }

  /**
   * Save CSS/JS file
   */
  async saveAsset(filename, content, subdir) {
    const dir = path.join(OUTPUT_DIR, subdir);
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, content);
    this.filesUpdated++;
  }

  /**
   * Main scrape logic
   */
  async run() {
    const totalStart = Date.now();
    
    console.log('⚡ Intelligent Incremental Scraper Starting...');
    console.log(`Site: ${this.siteUrl}`);
    
    if (this.fullScrape) {
      console.log('📦 Full scrape mode (--full)');
    } else {
      const hasCache = await this.loadCache();
      console.log(hasCache ? '📦 Using cache for incremental sync' : '📦 No cache found - full scrape');
    }

    // Ensure output directories exist
    await fs.mkdir(path.join(OUTPUT_DIR, 'html'), { recursive: true });
    await fs.mkdir(path.join(OUTPUT_DIR, 'css'), { recursive: true });
    await fs.mkdir(path.join(OUTPUT_DIR, 'js'), { recursive: true });
    await fs.mkdir(METADATA_DIR, { recursive: true });

    // Step 1: Get homepage links (fetch or use cache)
    const homepageStart = Date.now();
    let homepage;
    const homepageCacheKey = this.normalizeCacheKey(this.siteUrl);
    const cachedHomepage = !this.fullScrape && this.cache[homepageCacheKey];
    const cachedLinks = cachedHomepage?.links;

    // Quick HEAD check for homepage when we have cached links
    let homepageNeedsFetch = true;
    if (cachedLinks && Array.isArray(cachedLinks) && cachedLinks.length > 0) {
      const lastModified = await this.getLastModified(this.siteUrl);
      if (lastModified === cachedHomepage.lastModified) {
        homepageNeedsFetch = false;
      }
    }

    if (homepageNeedsFetch) {
      try {
        homepage = await this.fetchPage(this.siteUrl);
        this.timings.homepage = Date.now() - homepageStart;
        console.log(`✓ Homepage ${this.fullScrape ? 'fetched' : 'changed'} (${this.timings.homepage}ms)`);
      } catch (err) {
        console.error('✗ Failed to fetch homepage:', err.message);
        process.exit(1);
      }
    } else {
      this.timings.homepage = Date.now() - homepageStart;
      console.log(`✓ Homepage unchanged, using cache (${this.timings.homepage}ms)`);
      // Use cached links - create minimal homepage object for link list
      homepage = { links: cachedLinks };
    }

    // Build full link list (homepage + internal links)
    const allLinks = [this.siteUrl];
    const baseOrigin = new URL(this.siteUrl).origin;
    for (const link of homepage.links || []) {
      if (!allLinks.includes(link) && link.startsWith(baseOrigin)) {
        allLinks.push(link);
      }
    }
    this.timings.linkExtraction = 0;
    console.log(`✓ Found ${allLinks.length} internal links`);

    // Step 2: Determine which pages to scrape (homepage already counted above if skipped)
    const pagesToScrape = await this.determinePagesToScrape(allLinks);
    this.pagesScraped = pagesToScrape.length;
    // Recalculate skipped: total - scraped (pagesSkipped already incremented for homepage if cached)
    this.pagesSkipped = allLinks.length - pagesToScrape.length;

    console.log('\n📊 Incremental Analysis:');
    console.log(`   Total pages: ${allLinks.length}`);
    console.log(`   Need scraping: ${pagesToScrape.length}`);
    console.log(`   Skipping: ${this.pagesSkipped}`);
    if (this.pagesSkipped > 0) {
      const savedSec = Math.round((this.pagesSkipped * 2) / 1000);
      console.log(`   Time saved: ~${savedSec}s`);
    }

    // Step 3: Fetch changed pages
    const fetchStart = Date.now();
    const pageResults = [];
    for (const url of pagesToScrape) {
      try {
        const result = await this.fetchPage(url);
        pageResults.push(result);
      } catch (err) {
        console.warn(`⚠ Failed to fetch ${url}:`, err.message);
      }
    }
    this.timings.changedPages = Date.now() - fetchStart;
    console.log(`\n✓ Fetched ${pageResults.length} changed pages (${this.timings.changedPages}ms)`);

    // Collect all unique assets from scraped pages
    const assetUrls = new Set();
    const allInlineStyles = [];
    const allInlineScripts = [];
    
    for (const page of pageResults) {
      page.assets.css.forEach(u => assetUrls.add(JSON.stringify({ url: u, type: 'css' })));
      page.assets.js.forEach(u => assetUrls.add(JSON.stringify({ url: u, type: 'js' })));
      page.inlineStyles.forEach(s => allInlineStyles.push(s));
      page.inlineScripts.forEach(s => allInlineScripts.push(s));
    }

    // Step 4: Fetch assets in parallel (5 concurrent)
    const assetStart = Date.now();
    const assetsToFetch = Array.from(assetUrls).map(s => JSON.parse(s));
    const assetResults = [];
    const chunks = this.chunkArray(assetsToFetch, CONCURRENT_ASSET_LIMIT);
    
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(a => this.fetchAsset(a.url)));
      results.forEach((r, i) => {
        if (r) assetResults.push({ ...chunk[i], ...r });
      });
    }
    this.timings.assets = Date.now() - assetStart;
    console.log(`✓ Assets processed (${this.timings.assets}ms)`);

    // Step 5: Save files
    const saveStart = Date.now();
    this.filesUpdated = 0;

    // Save HTML pages
    for (const page of pageResults) {
      const filename = this.urlToFilename(page.url, '.html');
      await this.saveHtml(filename, page.html);
      
      const cacheKey = this.normalizeCacheKey(page.url);
      this.cache[cacheKey] = {
        hash: page.hash,
        lastModified: page.lastModified,
        timestamp: new Date().toISOString(),
        links: page.links // Cache links for homepage to avoid re-fetch when unchanged
      };
    }

    // Save external assets
    for (const asset of assetResults) {
      const ext = asset.type === 'css' ? '.css' : '.js';
      const filename = this.urlToFilename(asset.url, ext);
      await this.saveAsset(filename, asset.content, asset.type);
      
      this.cache.assets[asset.url] = {
        timestamp: new Date().toISOString(),
        size: asset.size
      };
    }

    // Save inline styles
    for (let i = 0; i < allInlineStyles.length; i++) {
      await this.saveAsset(`inline-${i}.css`, allInlineStyles[i], 'css');
      this.inlineStyleCount++;
    }

    // Save inline scripts
    for (let i = 0; i < allInlineScripts.length; i++) {
      await this.saveAsset(`inline-${i}.js`, allInlineScripts[i], 'js');
      this.inlineScriptCount++;
    }

    this.timings.saveFiles = Date.now() - saveStart;
    console.log(`✓ Updated ${this.filesUpdated} files (${this.timings.saveFiles}ms)`);

    // Step 6: Update metadata
    const metaStart = Date.now();
    await this.saveCache();

    const lastSync = {
      timestamp: new Date().toISOString(),
      siteUrl: this.siteUrl,
      pagesScraped: this.pagesScraped,
      pagesSkipped: this.pagesSkipped,
      totalPages: allLinks.length,
      filesUpdated: this.filesUpdated,
      fullScrape: this.fullScrape,
      timings: this.timings
    };
    await fs.writeFile(LAST_SYNC_FILE, JSON.stringify(lastSync, null, 2));

    // Append to sync history
    let history = [];
    try {
      const histData = await fs.readFile(SYNC_HISTORY_FILE, 'utf-8');
      history = JSON.parse(histData);
    } catch {}
    history.unshift(lastSync);
    history = history.slice(0, SYNC_HISTORY_MAX);
    await fs.writeFile(SYNC_HISTORY_FILE, JSON.stringify(history, null, 2));

    this.timings.metadata = Date.now() - metaStart;
    console.log(`✓ Metadata updated (${this.timings.metadata}ms)`);

    // Performance report
    const totalTime = Date.now() - totalStart;
    const efficiency = allLinks.length > 0 
      ? Math.round((this.pagesSkipped / allLinks.length) * 100) 
      : 0;

    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎉 INCREMENTAL SYNC COMPLETE!');
    console.log('\n📊 Performance Report:');
    console.log('──────────────────────────────────────────────────');
    console.log(`Homepage check:     ${(this.timings.homepage || 0)}ms`);
    console.log(`Link extraction:    ${(this.timings.linkExtraction || 0)}ms`);
    console.log(`Change analysis:    ${(this.timings.changeAnalysis || 0)}ms`);
    console.log(`Changed pages:      ${(this.timings.changedPages || 0)}ms`);
    console.log(`Assets:             ${(this.timings.assets || 0)}ms`);
    console.log(`Save files:         ${(this.timings.saveFiles || 0)}ms`);
    console.log(`Metadata:           ${(this.timings.metadata || 0)}ms`);
    console.log('──────────────────────────────────────────────────');
    console.log(`TOTAL TIME:         ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log('──────────────────────────────────────────────────');
    console.log(`Total pages:        ${allLinks.length}`);
    console.log(`Changed:            ${this.pagesScraped}`);
    console.log(`Skipped:            ${this.pagesSkipped}`);
    console.log(`Efficiency:         ${efficiency}% faster`);
    console.log('═══════════════════════════════════════════════════\n');

    return {
      success: true,
      totalTime,
      pagesScraped: this.pagesScraped,
      pagesSkipped: this.pagesSkipped,
      filesUpdated: this.filesUpdated
    };
  }
}

/**
 * Load .env file into process.env (optional, no external deps)
 */
function loadEnv() {
  try {
    const fsSync = require('fs');
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (fsSync.existsSync(envPath)) {
      const content = fsSync.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      });
    }
  } catch {
    // Ignore - .env is optional
  }
}

// Main entry point
async function main() {
  loadEnv();
  const siteUrl = process.env.WEBFLOW_SITE_URL;
  if (!siteUrl) {
    console.error('✗ WEBFLOW_SITE_URL environment variable is required');
    console.error('  Set it in .env or: export WEBFLOW_SITE_URL=https://yoursite.webflow.io');
    process.exit(1);
  }

  const fullScrape = process.argv.includes('--full');
  const scraper = new IncrementalScraper(siteUrl, fullScrape);
  
  try {
    const result = await scraper.run();
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('✗ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
