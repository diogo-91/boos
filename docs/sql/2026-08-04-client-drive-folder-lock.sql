-- Fecha o M3 de verdade (criação de pasta do cliente sem lock, permitindo
-- duas requisições concorrentes criarem pasta duplicada pro mesmo cliente).
-- Mesmo padrão do drive_scan_lock, só que uma linha por cliente em vez de
-- singleton — a linha existe só enquanto uma criação está em andamento e é
-- apagada logo depois (não acumula).

create table if not exists client_drive_folder_lock (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  locked_at timestamptz not null
);
