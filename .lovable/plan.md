# Plano: Remover seção Shopee Affiliate API

O usuário solicitou a remoção do campo "Shopee Affiliate API" e sua descrição nas configurações. Analisando o arquivo `src/routes/_authenticated/settings.tsx`, identifiquei um Card inteiro dedicado a essas configurações que deve ser removido.

## Alterações

### Frontend
- **Configurações**: Remover o componente `Card` que contém o título "Shopee Affiliate API", a descrição e os campos `shopee_app_id` e `shopee_app_secret` em `src/routes/_authenticated/settings.tsx`.
- **Estado do Formulário**: Manter os campos no estado `formData` e na mutação para evitar quebras de API no banco de dados, mas ocultá-los da interface conforme solicitado.

## Detalhes Técnicos
- O arquivo `src/routes/_authenticated/settings.tsx` será editado para remover as linhas 108 a 137.
- Não haverá alteração no banco de dados neste momento, apenas na interface do usuário (UI).
