import { NextResponse } from 'next/server';
import { persistentCache } from '../../../../lib/persistentCache';

const NEGATIVE_KEYWORDS = [
  'carte', 'cards', 'booster', 'carddass', 't-shirt', 'tshirt', 'pull', 'sweat',
  'mug', 'figurine', 'figma', 'nendoroid', 'poster', 'badge', 'porte-clé', 'keychain',
  'drapeau', 'peluche', 'plaid', 'casquette', 'chaussettes', 'sac', 'cosplay',
  'jeu', 'console', 'switch', 'ps4', 'ps5', 'xbox', 'tome unique vide', 'classeur',
  'box vide', 'boite vide'
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const title = searchParams.get('title') || '';
    const imageUrl = searchParams.get('imageUrl') || '';

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'annonce est requis." }, { status: 400 });
    }

    // 1. Check persistent cache
    const cached = persistentCache.getOpenAi(id);
    if (cached) {
      console.log(`[Verify AI Cache Hit] Item ${id}: is_book=${cached.is_book}`);
      return NextResponse.json(cached);
    }

    // 2. Local negative keyword check
    const normalizedTitle = title.toLowerCase();
    const matchesKeyword = NEGATIVE_KEYWORDS.find(kw => normalizedTitle.includes(kw));
    if (matchesKeyword) {
      const result = {
        is_book: false,
        reason: `Exclu automatiquement par mot-clé : "${matchesKeyword}"`
      };
      persistentCache.setOpenAi(id, result);
      console.log(`[Verify Local Auto-Exclusion] Item ${id} ("${title}"): is_book=false (${result.reason})`);
      return NextResponse.json(result);
    }

    // 3. Image analysis check using OpenAI Vision
    if (!imageUrl) {
      const result = {
        is_book: true,
        reason: "Aucune image fournie, accepté par défaut."
      };
      persistentCache.setOpenAi(id, result);
      return NextResponse.json(result);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        is_book: true,
        reason: "Clé OpenAI non configurée sur le serveur. Passage automatique."
      });
    }

    console.log(`[Verify AI Request] Classifying image for item ${id} ("${title}")...`);
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this Vinted listing image and its title: "${title}". Determine if the main product shown in the image is a book (manga volume, novel, comic book, or light novel). Respond strictly in JSON format with two keys: "is_book" (boolean) and "reason" (string, short explanation in French). Do not include any markdown formatting like \`\`\`json.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 150,
        response_format: { type: "json_object" }
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("[Verify AI API Error]", errorText);
      return NextResponse.json({
        is_book: true,
        reason: `Erreur API OpenAI (Status: ${openAiRes.status}).`
      });
    }

    const data = await openAiRes.json();
    if (data.choices && data.choices[0]) {
      const parsedResult = JSON.parse(data.choices[0].message.content);
      persistentCache.setOpenAi(id, parsedResult);
      console.log(`[Verify AI Result] Item ${id}: is_book=${parsedResult.is_book} - Reason: ${parsedResult.reason}`);
      return NextResponse.json(parsedResult);
    }

    return NextResponse.json({
      is_book: true,
      reason: "Format de réponse OpenAI inattendu."
    });

  } catch (error: any) {
    console.error("[Verify Route Error]", error);
    return NextResponse.json({
      is_book: true,
      reason: `Une erreur interne s'est produite: ${error.message || String(error)}`
    });
  }
}
