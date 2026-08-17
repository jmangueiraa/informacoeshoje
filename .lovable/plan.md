# Plano: Desativar Verificação de E-mail

O objetivo é desativar a necessidade de confirmação de e-mail para novos cadastros e ajustar a interface do usuário para refletir essa mudança, permitindo que os usuários acessem o sistema imediatamente após o registro.

## Alterações de Infraestrutura (Backend)

- Configurar o provedor de autenticação no banco de dados para confirmar e-mails automaticamente (`auto_confirm_email: true`).
- Garantir que outras configurações de segurança permaneçam consistentes.

## Alterações de Frontend

### 1. Rota de Autenticação (`src/routes/auth.tsx`)
- Remover a lógica que exibe a mensagem de "verifique seu e-mail" após o cadastro.
- Garantir que o redirecionamento para o dashboard ocorra imediatamente após a criação da conta.

## Detalhes Técnicos
- Utilizar a ferramenta `supabase--configure_auth` para ajustar a configuração global de autenticação.
- Modificar o componente `AuthPage` para tratar a resposta do `signUp` do Supabase como um sucesso imediato se a sessão for criada.

## Validação
- Realizar um teste de cadastro manual (via script de automação ou instrução para o usuário) para confirmar que a sessão é estabelecida sem necessidade de clique em link de e-mail.
