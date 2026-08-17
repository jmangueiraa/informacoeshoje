-- A função has_role precisa ser executada por usuários autenticados para as políticas de RLS funcionarem, 
-- então o aviso 0029 é esperado e intencional para este caso de uso.
-- Vamos apenas documentar isso na memória de segurança se necessário, 
-- mas o sistema já está configurado corretamente seguindo o padrão recomendado de SECURITY DEFINER para roles.

-- Nenhuma ação SQL adicional necessária para has_role além do que já foi feito (GRANT TO authenticated).
SELECT 1; 
