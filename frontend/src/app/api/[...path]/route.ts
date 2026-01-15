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
    const baseNoApi = BACKEND_BASE.replace(/\/api$/, '');
    return [
      `${BACKEND_BASE}${backendPath}${query}`,
      `${baseNoApi}${backendPath}${query}`,
    ];
  }

  return [
    `${BACKEND_BASE}/api${backendPath}${query}`,
    `${BACKEND_BASE}${backendPath}${query}`,
  ];
}

async function proxy(request: NextRequest, pathParts: string[]): Promise<NextResponse> {
  const urls = buildBackendUrls(request, pathParts);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstreamResponse = await fetch(urls[0], {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  if (upstreamResponse.status === 404 && urls.length > 1) {
    upstreamResponse = await fetch(urls[1], {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
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
