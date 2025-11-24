import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const threshold = searchParams.get('threshold');
    const start = searchParams.get('start') || '0';
    const end = searchParams.get('end') || '';

    let url = `${BACKEND_URL}/api/spikes/${params.fileId}?threshold=${threshold}&start=${start}`;
    if (end) {
      url += `&end=${end}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Spikes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spikes' },
      { status: 500 }
    );
  }
}
