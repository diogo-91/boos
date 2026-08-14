-- O check constraint de clientes.status nasceu sem 'parceiros' — o sync
-- falha ao criar cliente para pasta em 06_parceiros (erro 23514).
-- Descobre o nome real do constraint e o recria com a lista completa de
-- slugs que STATUS_DB_MAP (lib/drive-status-map.ts) pode gravar.
DO $$
DECLARE
  nome text;
BEGIN
  SELECT conname INTO nome
  FROM pg_constraint
  WHERE conrelid = 'clientes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF nome IS NOT NULL THEN
    EXECUTE format('ALTER TABLE clientes DROP CONSTRAINT %I', nome);
  END IF;

  ALTER TABLE clientes
    ADD CONSTRAINT clientes_status_check
    CHECK (status IN ('ativo','audiencia','arquivado','cancelado','contratacao','dativo','parceiros','sarandi'));
END $$;
