export const PLATFORM_DOMAIN = "infomacoeshoje.online";
// Domínio padrão usado nos links curtos enviados aos clientes
export const LINK_DOMAIN = "links.editaveisdocanva.com.br";
export const PLATFORM_BASE_URL = `https://${PLATFORM_DOMAIN}`;
export const PLATFORM_NAME = "LinkAfiliado";

// Domínios disponíveis no criador de links
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
    domain: "infomacoeshoje.online",
    label: "infomacoeshoje.online",
    is_primary: false,
    verification_status: "verified"
  }
];

// Usuários sem acesso à Captura de Contatos
export const CONTACTS_BLOCKED_EMAILS = ["beatrizcosta.costa1994@gmail.com"];
