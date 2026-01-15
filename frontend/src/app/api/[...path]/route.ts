import { NextRequest, NextResponse } from 'next/server';

const RAW_BACKEND_ORIGIN = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BACKEND_ORIGIN = RAW_BACKEND_ORIGIN.replace(/\/api\/?$/, '');

type RouteContext = {
  // In newer Next.js versions, dynamic route params are provided as a Promise.
  params: Promise<{ path?: string[] }>;
};

function buildBackendUrl(request: NextRequest, pathParts: string[]): string {
  const backendPath = pathParts.length ? `/${pathParts.join('/')}` : '';
  return `${BACKEND_ORIGIN}/api${backendPath}${request.nextUrl.search}`;
}

async function proxy(request: NextRequest, pathParts: string[]): Promise<NextResponse> {
  const url = buildBackendUrl(request, pathParts);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstreamResponse = await fetch(url, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

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
