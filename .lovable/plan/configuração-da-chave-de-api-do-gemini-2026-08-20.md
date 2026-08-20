# Configuração da Chave de API do Gemini

Este plano descreve a configuração da chave de API do Gemini fornecida pelo usuário como uma variável de ambiente no projeto.

## Alterações

### Configuração de Segredos
- **Ação**: Armazenar a chave de API `AQ.Ab8RN6JmrTCG3VhxLQnIrq0PjpCSbiiKEJZMZxukNvh1PQprgA` no segredo `GEMINI_API_KEY`.
- **Motivo**: O processamento de imagens e captura de contatos agora utiliza o Google Gemini e requer esta chave para funcionar.

## Verificação
1. Validar se a variável `GEMINI_API_KEY` está disponível no ambiente do backend.
2. Testar a funcionalidade de "Extrair Dados" na página de contatos para confirmar que a comunicação com o Gemini está ativa.
