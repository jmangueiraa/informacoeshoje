# Plano para Adicionar Branding no Rodapé

Adicionar a frase "Criado pela empresa de entretenimento AJP-19981356505" no rodapé das principais visualizações do aplicativo.

## Alterações

### Frontend

- **`src/routes/index.tsx`**:
    - Adicionar a frase de branding abaixo do texto de termos de uso no `CardFooter`.
- **`src/routes/_authenticated.tsx`**:
    - Adicionar um rodapé fixo ou no final do conteúdo principal (`main`) com a frase de branding, garantindo que seja visível em todas as páginas autenticadas.

## Detalhes Técnicos

- Utilizar classes Tailwind para garantir que o texto seja discreto (`text-xs`, `text-muted-foreground`) e bem alinhado.
- No layout autenticado, o rodapé será posicionado no final do elemento `main` para acompanhar o scroll do conteúdo.

## Validação

- Verificar a página de login para confirmar a presença do texto.
- Verificar o dashboard e outras páginas internas para confirmar a presença do rodapé.
