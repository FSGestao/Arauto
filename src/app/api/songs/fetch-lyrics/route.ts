import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST — buscar legendas automaticamente de um vídeo do YouTube
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { youtubeUrl } = await req.json();
  if (!youtubeUrl) {
    return NextResponse.json({ error: "URL do YouTube é obrigatória" }, { status: 400 });
  }

  // Extrair Video ID
  const match = youtubeUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) {
    return NextResponse.json({ error: "URL do YouTube inválida" }, { status: 400 });
  }

  const videoId = match[1];

  try {
    // Usar youtube-captions-scraper para extrair as legendas
    const { getSubtitles } = await import("youtube-captions-scraper");

    let captions;
    try {
      // Tentar legendas em português primeiro
      captions = await getSubtitles({ videoID: videoId, lang: "pt" });
    } catch {
      try {
        // Fallback para português brasileiro
        captions = await getSubtitles({ videoID: videoId, lang: "pt-BR" });
      } catch {
        try {
          // Fallback para inglês
          captions = await getSubtitles({ videoID: videoId, lang: "en" });
        } catch {
          // Auto-generated
          captions = await getSubtitles({ videoID: videoId, lang: "pt", type: "auto" });
        }
      }
    }

    if (!captions || captions.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma legenda encontrada para este vídeo. Adicione as letras manualmente." },
        { status: 404 }
      );
    }

    // Converter para o formato de letras sincronizadas
    const lyrics = captions.map(
      (cap: { start: string | number; dur: string | number; text: string }, index: number) => {
        const startMs = Math.round(parseFloat(String(cap.start)) * 1000);
        const durMs = Math.round(parseFloat(String(cap.dur)) * 1000);
        return {
          startMs,
          endMs: startMs + durMs,
          text: cap.text.replace(/\n/g, " ").trim(),
          order: index,
        };
      }
    );

    return NextResponse.json({
      videoId,
      lyrics,
      source: "youtube-captions",
    });
  } catch (error) {
    console.error("YouTube captions error:", error);
    return NextResponse.json(
      {
        error: "Não foi possível extrair legendas. Tente adicionar as letras manualmente.",
      },
      { status: 500 }
    );
  }
}
