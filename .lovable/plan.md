# Plano de Implementação - Fontes de Notícias Reais (UOL, O Globo, etc.)

Adicionar fontes de notícias reais (UOL, O Globo, G1) ao Radar Viral e à seção de Tendências para aumentar a credibilidade e variedade dos conteúdos sugeridos.

## Ações

### 1. Banco de Dados
- Criar migração para adicionar novas sementes (seeds) à tabela `viral_contents` e `trending_topics` com dados simulados dessas fontes específicas, preparando o terreno para futuras integrações reais via API.

### 2. Backend (Server Functions)
- Atualizar `src/lib/news/trends.functions.ts`:
    - Adicionar mocks de notícias do UOL e O Globo no `TRENDS_MOCK`.
- Atualizar `src/lib/news/viral.functions.ts`:
    - Expandir `TRENDING_MOCK` com uma maior variedade de conteúdos reais simulados de grandes portais brasileiros.
    - Ajustar a lógica de `refreshViralRadar` para rotacionar entre fontes diferentes (UOL, G1, O Globo, Redes Sociais).

### 3. Frontend (UI)
- Atualizar `src/routes/_authenticated/viral.tsx`:
    - Garantir que os logos ou nomes das fontes (UOL, O Globo) apareçam claramente nos cards.
    - Adicionar um indicador visual ou "Badge" para fontes verificadas de notícias.
- Atualizar `src/components/dashboard/TrendingSection.tsx`:
    - Refletir as novas fontes na lista de assuntos em alta.

## Detalhes Técnicos
- Utilizar nomes reais de fontes nos campos `source`.
- Incluir URLs de imagem que remetam ao contexto das notícias dessas fontes.
- Tipagem: Manter as estruturas de dados existentes para garantir compatibilidade com o editor.
