-- Diagnóstico read-only: não altera nada, só mostra o estado atual.
-- Rode as duas consultas no SQL Editor do Supabase.

-- 1) Quais tabelas do schema public têm RLS ligado.
--    rls_habilitado = false  → tabela acessível por completo via chave anônima,
--    sem nenhuma restrição de linha, independente do middleware do app.
select
  schemaname,
  tablename,
  rowsecurity as rls_habilitado
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2) Quais políticas existem em cada tabela.
--    RLS ligado (rls_habilitado = true) SEM nenhuma linha aqui pra ela =
--    tabela completamente bloqueada até pra chave anônima (efeito equivalente
--    a "app não funciona"), não só "protegida".
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
