# Plano de Configuração de DNS e Domínio Personalizado

Para que o domínio `ajpvip.com.br` funcione corretamente como o redirecionador dos seus links, precisamos realizar as configurações técnicas e orientar sobre a ponta do DNS.

## Ações Realizadas / Em Andamento

1.  **Configuração de Banco de Dados**:
    *   Garantir que o domínio `ajpvip.com.br` esteja registrado na tabela `user_domains` vinculado ao seu usuário.
    *   Definir este domínio como o padrão no seu perfil (`profiles`).

2.  **Interface de Usuário (UI)**:
    *   Adicionar uma seção de "Configurações de Domínio" no Dashboard ou na página de Links.
    *   Exibir os registros DNS necessários (CNAME/A) para que o usuário saiba o que configurar no provedor (Ex: Cloudflare, Registro.br).

3.  **Lógica de Redirecionamento**:
    *   Ajustar o `registerClick` e a rota `$slug.tsx` para reconhecer acessos vindos através do domínio `ajpvip.com.br` e processar o redirecionamento Shopee corretamente.

## Detalhes Técnicos

### Registros DNS Necessários
Você precisará adicionar os seguintes registros no seu painel de domínio:

| Tipo | Nome | Valor |
| :--- | :--- | :--- |
| **CNAME** | `@` ou `www` | `noticiasviraisctv.lovable.app` |

*Nota: Se o seu provedor não permitir CNAME na raiz (@), use um registro tipo ALIAS ou redirecionamento de DNS.*

## Próximos Passos
- [ ] Criar interface de exibição de status do DNS.
- [ ] Validar a detecção de hostname no servidor para aplicar o redirecionamento customizado.
