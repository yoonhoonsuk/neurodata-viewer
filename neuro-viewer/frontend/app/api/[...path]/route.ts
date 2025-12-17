import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
  try {
    const apiPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    const options: RequestInit = {
      method,
    };

    // Include body for POST requests
    if (method === 'POST') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('multipart/form-data')) {
        // For FormData, let fetch set the content-type with correct boundary
        options.body = await request.formData();
      } else {
        // For other types, include headers and body
        options.headers = request.headers;
        options.body = await request.text();
      }
    } else {
      // For GET requests, include headers
      options.headers = request.headers;
    }

    const response = await fetch(url, options);

    // Check if response is binary data (e.g., from /api/data endpoint)
    const contentType = response.headers.get('content-type');
    const isBinary = contentType?.includes('application/octet-stream');

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      return NextResponse.json(error, { status: response.status });
    }

    // Handle binary responses (raw waveform data)
    if (isBinary) {
      const arrayBuffer = await response.arrayBuffer();

      // Preserve all headers from backend
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        headers.set(key, value);
      });

      return new NextResponse(arrayBuffer, {
        status: response.status,
        headers,
      });
    }

    // Handle JSON responses (metadata, upload results, etc.)
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}
