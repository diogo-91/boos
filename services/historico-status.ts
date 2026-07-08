import type { StatusHistoryEntity, StatusHistoryEntry } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";

type HistoricoStatusRow = Record<string, unknown>;

type RegistrarHistoricoStatusInput = {
  entity: StatusHistoryEntity;
  entityId: string;
  previousStatus: string;
  newStatus: string;
  eventDate?: string;
  note?: string;
};

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function asOptionalString(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function formatDisplayDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  const text = String(value);
  const [datePart, timePart] = text.split("T");

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-");
    const time = timePart ? ` ${timePart.slice(0, 5)}` : "";
    return `${day}/${month}/${year}${time}`;
  }

  return text;
}

function mapHistoricoFromDb(row: HistoricoStatusRow): StatusHistoryEntry {
  return {
    id: asString(row.id),
    entity: asString(row.entidade) as StatusHistoryEntity,
    entityId: asString(row.entidade_id),
    previousStatus: asString(row.status_anterior),
    newStatus: asString(row.status_novo),
    eventDate: formatDisplayDate(row.data_evento),
    note: asOptionalString(row.observacao)
  };
}

export async function registrarHistoricoStatus({
  entity,
  entityId,
  previousStatus,
  newStatus,
  eventDate = new Date().toISOString().slice(0, 10),
  note
}: RegistrarHistoricoStatusInput) {
  const { data, error } = await getSupabaseClient()
    .from("historico_status")
    .insert({
      entidade: entity,
      entidade_id: entityId,
      status_anterior: previousStatus,
      status_novo: newStatus,
      data_evento: eventDate,
      observacao: note ?? null
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapHistoricoFromDb(data);
}

export async function listarHistoricoPorEntidade(
  entity: StatusHistoryEntity,
  entityId: string
) {
  const { data, error } = await getSupabaseClient()
    .from("historico_status")
    .select("*")
    .eq("entidade", entity)
    .eq("entidade_id", entityId)
    .order("data_evento", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapHistoricoFromDb);
}
