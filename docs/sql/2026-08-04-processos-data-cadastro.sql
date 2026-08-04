-- Fecha o Bug 24 (processos): a tabela processos não tinha nenhuma coluna
-- de data de criação, então "Últimos Processos" no dashboard só podia
-- aproximar por ordem alfabética de CNJ (listarProcessos ordena por
-- numero_cnj), não pela ordem real de cadastro.
--
-- Processos já existentes ficam com data_cadastro NULL (não dá pra saber
-- retroativamente quando foram criados de verdade — melhor deixar em
-- branco do que inventar uma data). A partir desta migration, todo processo
-- novo (criado pelo formulário, pela varredura do Drive ou pela leitura por
-- IA) grava essa data automaticamente.

alter table processos add column if not exists data_cadastro date;
