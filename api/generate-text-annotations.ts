import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { images, prompt } = req.body;
  if (!images || !prompt) {
    return res.status(400).json({ error: 'Missing required fields: images, prompt' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
    for (const img of images) {
      parts.push({ inlineData: { data: img.base64Data, mimeType: img.mimeType } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text)
      .join('') || '';

    if (!rawText) {
      return res.status(500).json({ error: 'No text response from model' });
    }

    const parsed = JSON.parse(rawText);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Text annotation API error:', err);
    return res.status(500).json({ error: 'Failed to generate text annotations' });
  }
}
