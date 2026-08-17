# Plano: Gerador de Fake News Baseado em Imagem

Implementar um sistema de geração de "fake news" humorísticas/virais que analisa o contexto da imagem carregada no editor para sugerir títulos e curiosidades impactantes, integrando com a IA da Lovable.

## Alterações Técnicas

### Frontend
- **src/routes/_authenticated/editor.$id.tsx**:
  - Modificar a função `generateCuriosity` para que ela envie a imagem atual (ou metadados contextuais) para uma nova função de servidor.
  - Adicionar um novo botão "Gerar Notícia Fake" ou aprimorar o "Gerar IA" para preencher tanto o Título quanto a Curiosidade.
  - Otimizar o renderizador Canvas para lidar com as novas sugestões.

### Backend (Server Functions)
- **src/lib/news/editor.functions.ts** (Novo arquivo):
  - Criar `generateViralContentFromImage`: Uma Server Function que recebe a `imageUrl` (ou base64) e utiliza o Lovable AI Gateway para descrever a imagem e inventar uma notícia viral baseada nela.
  - A função retornará um objeto com `{ suggestedTitle, suggestedCuriosity }`.

### IA Prompting
- Configurar o prompt da IA para adotar uma persona de "Especialista em Viralização Humorística", garantindo que o conteúdo seja satírico/engraçado (respeitando as diretrizes de segurança e a marca d'água obrigatória).

## Verificação
- Testar o upload de diferentes imagens (natureza, tecnologia, pessoas) e verificar se as sugestões de "fake news" são contextuais.
- Validar se o título e a curiosidade são renderizados corretamente no Canvas com a marca d'água "FakeNews Studio".
