import { type NextRequest } from "next/server";

const API_PROXY_PREFIX = "/api/backend/";
const FALLBACK_API_BASE_URL = "http://localhost:8000/api/v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    FALLBACK_API_BASE_URL
  ).replace(/\/$/, "");
}

function getTargetUrl(request: NextRequest) {
  const proxyPath = request.nextUrl.pathname.startsWith(API_PROXY_PREFIX)
    ? request.nextUrl.pathname.slice(API_PROXY_PREFIX.length)
    : "";
  const normalizedProxyPath = proxyPath.replace(/^\/+|\/+$/g, "");
  const backendPath = normalizedProxyPath ? `${normalizedProxyPath}/` : "";

  return `${getBackendBaseUrl()}/${backendPath}${request.nextUrl.search}`;
}

function getForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("host");

  return headers;
}

function getResponseHeaders(response: Response) {
  const headers = new Headers(response.headers);

  headers.delete("connection");
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  return headers;
}

async function proxyRequest(request: NextRequest) {
  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: getForwardHeaders(request),
    cache: "no-store",
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(getTargetUrl(request), init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: getResponseHeaders(response),
  });
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function HEAD(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyRequest(request);
}
