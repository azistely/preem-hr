import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key not configured' },
      { status: 503 }
    );
  }

  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 2 * 60 * 1000
    ).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({ token: token.name });
  } catch (error) {
    console.error('[gemini-live-token] Failed to create ephemeral token:', error);
    return NextResponse.json(
      { error: 'Failed to create session token' },
      { status: 500 }
    );
  }
}
