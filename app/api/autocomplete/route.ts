import { NextResponse } from 'next/server';
import { retrieveAddress, suggestAddresses } from '@/lib/providers/mapbox';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const session = params.get('session');

  if (!session) {
    return NextResponse.json({ error: 'session is required' }, { status: 400 });
  }

  try {
    const mapboxId = params.get('id');
    if (mapboxId) {
      const result = await retrieveAddress(mapboxId, session);
      if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    const query = params.get('q') ?? '';
    return NextResponse.json({ suggestions: await suggestAddresses(query, session) });
  } catch {
    // Never leak provider errors or token state to the client.
    return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 });
  }
}
