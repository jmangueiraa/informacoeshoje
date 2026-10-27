export const PLATFORM_DOMAIN = "informacoeshoje.online";
// Domínio padrão usado nos links curtos enviados aos clientes
export const LINK_DOMAIN = "links.editaveisdocanva.com.br";
export const PLATFORM_BASE_URL = `https://${PLATFORM_DOMAIN}`;
export const PLATFORM_NAME = "LinkAfiliado";

// Domínios disponíveis no criador de links para todos os usuários
export const PREDEFINED_DOMAINS = [
  {
    id: "canva-links",
    domain: "links.editaveisdocanva.com.br",
    label: "links.editaveisdocanva.com.br (Principal)",
    is_primary: true,
    verification_status: "verified"
  },
  {
    id: "platform-default",
    domain: "informacoeshoje.online",
    label: "informacoeshoje.online",
    is_primary: false,
    verification_status: "verified"
  }
];

// Domínios exclusivos para o usuário Super Admin
export const ADMIN_PREDEFINED_DOMAINS = [
  {
    id: "canva-loja",
    domain: "links.editaveisdocanva.com.br/loja",
    label: "links.editaveisdocanva.com.br/loja",
    is_primary: false,
    verification_status: "verified"
  },
  {
    id: "canva-arquivos",
    domain: "www.editaveisdocanva.com.br/arquivos",
    label: "www.editaveisdocanva.com.br/arquivos",
    is_primary: false,
    verification_status: "verified"
  }
];

// Usuários sem acesso à Captura de Contatos
export const CONTACTS_BLOCKED_EMAILS = ["beatrizcosta.costa1994@gmail.com"];
