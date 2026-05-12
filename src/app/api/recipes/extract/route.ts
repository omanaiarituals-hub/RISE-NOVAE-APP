// src/app/api/recipes/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30s pour le call vision

const EXTRACTION_PROMPT = `Tu es un assistant qui extrait des recettes depuis des images.
Analyse cette image et extrais la recette au format JSON STRICT suivant :

{
  "title": "string",
  "servings": number | null,
  "ingredients": [
    {"name": "string", "quantity": number | null, "unit": "string | null"}
  ],
  "steps": ["string"],
  "cooking_time_minutes": number | null,
  "category": "string | null",
  "emoji": "string | null"
}

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le JSON, sans préambule, sans markdown, sans \`\`\`
- Si l'image contient PLUSIEURS recettes, extrais SEULEMENT la première
- Si une info n'est pas trouvable, mets null
- "ingredients" : les quantités numériques quand c'est possible, l'unité séparément (g, ml, cuillère à soupe, etc.)
- "steps" : tableau de strings, une étape par string, dans l'ordre
- "emoji" : choisis 1 emoji représentatif (ex: 🥞 pour pancakes, 🍝 pour pâtes)`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image provided. Send a file with key "image".' },
        { status: 400 }
      );
    }

    // Validation type + taille
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Must be an image.` },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large (max 5MB).' },
        { status: 400 }
      );
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call Claude Haiku 4.5 Vision
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[recipe extract] ANTHROPIC_API_KEY missing');
      return NextResponse.json(
        { error: 'Server config error' },
        { status: 500 }
      );
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.type,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      console.error('[Anthropic API error]', anthropicResponse.status, errorBody);
      return NextResponse.json(
        { error: 'AI extraction failed', status: anthropicResponse.status },
        { status: 502 }
      );
    }

    const data = await anthropicResponse.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse JSON (avec fallback si markdown fences)
    let recipe;
    try {
      const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
      recipe = JSON.parse(cleaned);
    } catch (e) {
      console.error('[JSON parse error]', rawText);
      return NextResponse.json(
        {
          error: 'Could not parse recipe from image. Try a clearer image.',
          raw_response: rawText,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('[recipe extract] unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: (error as Error).message },
      { status: 500 }
    );
  }
}