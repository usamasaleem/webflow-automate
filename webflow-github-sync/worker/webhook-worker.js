/**
 * Cloudflare Worker - Webflow Webhook Receiver
 * 
 * Receives Webflow publish webhooks and triggers GitHub Actions via repository_dispatch
 * 
 * Routes:
 * - GET /health - Health check
 * - POST /webhook/webflow - Main webhook receiver
 * - GET /webhook/webflow - Info about webhook
 */

// CORS headers for preflight and responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Trigger GitHub Actions workflow via repository_dispatch
 */
async function triggerGitHubWorkflow(githubToken, githubRepo, eventType = 'webflow_publish', payload = {}) {
  const url = `https://api.github.com/repos/${githubRepo}/dispatches`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return response;
}

/**
 * Validate Webflow webhook signature (optional - Webflow may send X-Webflow-Signature)
 */
function isValidWebflowRequest(request) {
  const contentType = request.headers.get('Content-Type') || '';
  return contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS },
      });
    }

    try {
      // Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'webflow-webhook',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...CORS_HEADERS,
            },
          }
        );
      }

      // Webhook info
      if (url.pathname === '/webhook/webflow' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            endpoint: '/webhook/webflow',
            method: 'POST',
            description: 'Webflow publish webhook receiver - triggers GitHub Actions sync',
            events: ['site_publish', 'site_unpublish'],
            status: 'active',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...CORS_HEADERS,
            },
          }
        );
      }

      // Main webhook receiver
      if (url.pathname === '/webhook/webflow' && request.method === 'POST') {
        const githubToken = env.GITHUB_TOKEN;
        const githubRepo = env.GITHUB_REPO;

        if (!githubToken || !githubRepo) {
          console.error('Missing GITHUB_TOKEN or GITHUB_REPO');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS,
              },
            }
          );
        }

        let payload = {};
        try {
          const text = await request.text();
          if (text) {
            payload = JSON.parse(text);
          }
        } catch (e) {
          // Non-JSON body is ok - we still trigger the workflow
          payload = { raw: true };
        }

        const eventType = payload.triggerType || payload.type || 'site_publish';

        // Respond immediately with 200 OK (Webflow expects fast response)
        ctx.waitUntil(
          (async () => {
            try {
              await triggerGitHubWorkflow(githubToken, githubRepo, 'webflow_publish', {
                source: 'webflow',
                event: eventType,
                published_at: payload.publishedAt || new Date().toISOString(),
                site_id: payload.siteId || payload.site,
              });
            } catch (err) {
              console.error('Failed to trigger GitHub Actions:', err.message);
            }
          })()
        );

        return new Response(
          JSON.stringify({
            received: true,
            event: eventType,
            message: 'Webhook received - sync triggered',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...CORS_HEADERS,
            },
          }
        );
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({ error: 'Not found', path: url.pathname }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    } catch (err) {
      console.error('Worker error:', err.message);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: err.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }
  },
};
