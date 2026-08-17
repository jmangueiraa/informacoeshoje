import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateViralContentFromImage = createServerFn({ method: "POST" })
  .validator((data: { imageUrl: string }) => z.object({ imageUrl: z.string() }).parse(data))
  .handler(async ({ data }) => {
    // Em um cenário real, usaríamos o AI Gateway para analisar a imagem.
    // Como estamos implementando a lógica inicial, vamos simular a resposta da IA
    // baseada em alguns padrões de URLs ou apenas retornar algo criativo genérico
    // que será aprimorado conforme a integração com Visão for disponibilizada.
    
    const isNature = data.imageUrl.includes('photo') || data.imageUrl.includes('nature');
    const isTech = data.imageUrl.includes('tech') || data.imageUrl.includes('computer');

    let title = "Descoberta Incrível Impacta o Mundo";
    let curiosity = "Cientistas afirmam que este fenômeno pode mudar tudo o que sabemos sobre a realidade atual.";

    if (isNature) {
      title = "Planta mutante encontrada na Amazônia";
      curiosity = "Botânicos descobriram que esta espécie consegue se comunicar através de frequências de rádio orgânicas.";
    } else if (isTech) {
      title = "IA desenvolve consciência e cria própria linguagem";
      curiosity = "O código gerado é tão complexo que nenhum computador humano consegue decifrar o que foi escrito até agora.";
    }

    // Simulando um delay de IA
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      suggestedTitle: title,
      suggestedCuriosity: curiosity
    };
  });
