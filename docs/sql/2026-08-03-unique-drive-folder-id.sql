-- Fecha a race de criação simultânea de pastas do Drive (achado C2 da
-- auditoria de 2026-08-03): garante no nível do banco que um
-- drive_folder_id nunca pode estar associado a mais de um cliente.
-- A checagem feita em código (services/google-drive.ts, criarPastaCliente)
-- não é atômica sozinha — só este constraint fecha a janela de race.
--
-- Rode as duas etapas abaixo, em ordem, no SQL Editor do Supabase.

-- 1) Rode isto PRIMEIRO. Se retornar alguma linha, existe cadastro duplicado
--    hoje na base (dois clientes apontando para a mesma pasta) — resolva
--    manualmente qual cliente é o dono correto de cada pasta e zere o
--    drive_folder_id do outro ANTES de seguir para a etapa 2, senão o
--    ALTER TABLE abaixo vai falhar com erro de violação de unicidade.
select drive_folder_id, array_agg(id) as clientes, array_agg(nome) as nomes
from clientes
where drive_folder_id is not null
group by drive_folder_id
having count(*) > 1;

-- 2) Só depois de confirmar que a consulta acima não retornou nenhuma linha:
alter table clientes
  add constraint clientes_drive_folder_id_unique unique (drive_folder_id);
