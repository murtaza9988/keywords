import { NextRequest, NextResponse } from 'next/server';

const RAW_BACKEND_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/$/, '');

type RouteContext = {
  // In newer Next.js versions, dynamic route params are provided as a Promise.
  params: Promise<{ path?: string[] }>;
};

function buildBackendUrls(request: NextRequest, pathParts: string[]): string[] {
  const backendPath = pathParts.length ? `/${pathParts.join('/')}` : '';
  const query = request.nextUrl.search;
  const baseHasApi = BACKEND_BASE.endsWith('/api');

  if (baseHasApi) {
    // BACKEND_BASE already ends with /api, so just append the path
    // Fallback: try without the /api prefix (in case backend is at root)
    const baseNoApi = BACKEND_BASE.replace(/\/api$/, '');
    return [
      `${BACKEND_BASE}${backendPath}${query}`,      // e.g. https://backend.com/api/logs
      `${baseNoApi}${backendPath}${query}`,         // e.g. https://backend.com/logs
    ];
  }

  // BACKEND_BASE doesn't have /api, so add it
  // Fallback: try at root without /api prefix
  return [
    `${BACKEND_BASE}/api${backendPath}${query}`,   // e.g. https://backend.com/api/logs
    `${BACKEND_BASE}${backendPath}${query}`,       // e.g. https://backend.com/logs
  ];
}

async function proxy(request: NextRequest, pathParts: string[]): Promise<NextResponse> {
  const urls = buildBackendUrls(request, pathParts);

  // Debug logging - will appear in Vercel function logs
  console.log('[API Proxy] Request:', {
    originalUrl: request.nextUrl.pathname + request.nextUrl.search,
    pathParts,
    BACKEND_BASE,
    API_URL: process.env.API_URL || '(not set)',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '(not set)',
    targetUrls: urls,
  });

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(urls[0], {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
    console.log('[API Proxy] First try:', urls[0], '→', upstreamResponse.status);
  } catch (err) {
    console.error('[API Proxy] First try FAILED:', urls[0], err);
    if (urls.length > 1) {
      upstreamResponse = await fetch(urls[1], {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
      });
      console.log('[API Proxy] Fallback result:', urls[1], '→', upstreamResponse.status);
    } else {
      throw err;
    }
  }

  if (upstreamResponse.status === 404 && urls.length > 1) {
    console.log('[API Proxy] Got 404, trying fallback:', urls[1]);
    upstreamResponse = await fetch(urls[1], {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
    console.log('[API Proxy] Fallback result:', upstreamResponse.status);
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-encoding');

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}
