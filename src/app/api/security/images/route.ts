import { NextRequest, NextResponse } from 'next/server';
import { verifyChallengeToken } from '@/lib/challenges';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const token = searchParams.get('token');

    if (!id || !token) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // Verify the metadata signature of the token to ensure it's a valid, unexpired challenge
    const isValid = await verifyChallengeToken(token, '', true);
    if (!isValid) {
      return new NextResponse('Invalid or expired token', { status: 403 });
    }

    const imageUrl = `https://picsum.photos/seed/${id}/200/200`;

    // Fetch the image from the source
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 1 week

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
