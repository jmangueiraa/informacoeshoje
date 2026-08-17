import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateViralContentFromImage = createServerFn({ method: "POST" })
  .validator((data: { imageUrl: string }) => z.object({ imageUrl: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    
    if (!LOVABLE_API_KEY) {
      // Fallback in case API key is missing during transition
      return {
        suggestedTitle: "Erro: IA não configurada",
        suggestedCuriosity: "Por favor, configure a chave de API do Lovable para usar a análise de imagem."
      };
    }

    try {
      const response = await fetch("https://api.lovable.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analise esta imagem e crie uma notícia viral (fake news humorística ou sensacionalista). Retorne APENAS um JSON com os campos 'suggestedTitle' (um título impactante e curto) e 'suggestedCuriosity' (um texto curto de curiosidade viral sobre a imagem). O texto deve ser em Português do Brasil.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: data.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", errorText);
        throw new Error("Falha na análise da imagem pela IA");
      }

      const result = await response.json();
      const content = JSON.parse(result.choices[0].message.content);
      
      return {
        suggestedTitle: content.suggestedTitle || "Título não gerado",
        suggestedCuriosity: content.suggestedCuriosity || "Curiosidade não gerada"
      };
    } catch (error) {
      console.error("Error generating content from image:", error);
      return {
        suggestedTitle: "Mistério revelado pela imagem",
        suggestedCuriosity: "Especialistas estão perplexos com os detalhes encontrados nesta foto recente."
      };
    }
  });
