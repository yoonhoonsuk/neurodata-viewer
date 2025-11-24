import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const duration = searchParams.get('duration');

    const response = await fetch(
      `${BACKEND_URL}/api/chunk/${params.fileId}?start=${start}&duration=${duration}`
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chunk error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chunk' },
      { status: 500 }
    );
  }
}
