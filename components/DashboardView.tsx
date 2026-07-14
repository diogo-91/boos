"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  Handshake,
  Clock,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  BarChart3,
  Activity
} from "lucide-react";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { STATUS_OPTIONS } from "@/lib/domain";
import { StatusBadge } from "@/components/StatusBadge";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

const STATUS_COLORS: Record<string, string> = {
  Ativo: "bg-emerald-500",
  Contratação: "bg-amber-400",
  Audiência: "bg-blue-500",
  Arquivado: "bg-slate-400",
  Cancelado: "bg-red-400",
  // Legados
  Sarandi: "bg-orange-400",
  Dativo: "bg-purple-500",
  Parceiros: "bg-sky-500",
  Andamento: "bg-emerald-400",
  "Aguard. documentos": "bg-yellow-400",
  "Aguard. audiência": "bg-blue-400",
  Acordado: "bg-violet-500",
  Encerrado: "bg-slate-400"
};

// Mostra sempre os 5 status atuais + qualquer status legado que ainda tenha
// registros (Dativo, Parceiros, Sarandi, status antigos de processo etc.).
function statusDisplayOrder(byStatus: Record<string, number>) {
  const legacy = Object.keys(byStatus).filter(
    (status) => !(STATUS_OPTIONS as string[]).includes(status)
  );
  return [...STATUS_OPTIONS, ...legacy];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft sm:gap-4 sm:p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${color}`}>
        <Icon size={20} className="text-white sm:size-[22px]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
        {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const width = pct(count, total);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900">{count}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function DashboardView() {
  const { clients, processes, isLoading } = useOperationalData();

  const stats = useMemo(() => {
    // ── Clientes por status ──────────────────────────────────────────────────
    const clientsByStatus: Record<string, number> = {};
    for (const c of clients) {
      clientsByStatus[c.status] = (clientsByStatus[c.status] ?? 0) + 1;
    }

    const ativos = clientsByStatus["Ativo"] ?? 0;

    // ── Processos por status ─────────────────────────────────────────────────
    const processosByStatus: Record<string, number> = {};
    for (const p of processes) {
      processosByStatus[p.status] = (processosByStatus[p.status] ?? 0) + 1;
    }

    // ── Processos por modelo de cobrança ─────────────────────────────────────
    const byBilling: Record<string, number> = {};
    for (const p of processes) {
      const m = p.billingModel || "Não definido";
      byBilling[m] = (byBilling[m] ?? 0) + 1;
    }

    // ── Parceiros ────────────────────────────────────────────────────────────
    const parceiroMap: Record<string, number> = {};
    for (const c of clients) {
      if (c.partner && c.partner !== "Nenhum" && c.partner !== "—") {
        parceiroMap[c.partner] = (parceiroMap[c.partner] ?? 0) + 1;
      }
    }
    const topParceiros = Object.entries(parceiroMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // ── Clientes sem processo ─────────────────────────────────────────────────
    const semProcesso = clients.filter(c => c.processIds.length === 0).length;

    // ── Clientes com Drive vinculado ─────────────────────────────────────────
    const comDrive = clients.filter(c => c.driveFolderId).length;

    // ── Processos recentes (últimos 10 criados, aproximação por id) ───────────
    // Usamos os 10 últimos da lista como proxy
    const recentProcesses = [...processes].slice(-8).reverse();

    // ── Clientes recentes ─────────────────────────────────────────────────────
    const recentClients = [...clients].slice(-6).reverse();

    return {
      totalClients: clients.length,
      totalProcesses: processes.length,
      totalParceiros: Object.keys(parceiroMap).length,
      ativos,
      clientsByStatus,
      processosByStatus,
      byBilling,
      topParceiros,
      semProcesso,
      comDrive,
      recentProcesses,
      recentClients
    };
  }, [clients, processes]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Activity size={24} className="mr-2 animate-pulse" />
        Carregando dashboard…
      </div>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">

      {/* ── KPIs principais ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total de Clientes"
          value={stats.totalClients}
          sub={`${stats.comDrive} com Drive vinculado`}
          icon={Users}
          color="bg-navy-800"
        />
        <KpiCard
          label="Total de Processos"
          value={stats.totalProcesses}
          sub={`${stats.semProcesso} clientes sem processo`}
          icon={FileText}
          color="bg-emerald-600"
        />
        <KpiCard
          label="Parceiros Ativos"
          value={stats.totalParceiros}
          sub="com indicações vinculadas"
          icon={Handshake}
          color="bg-sky-600"
        />
      </div>

      {/* ── Linha 2: Status clientes + Status processos ──────────────────── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">

        {/* Status dos clientes */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Clientes por Status</SectionTitle>
            <span className="text-xs text-slate-400">{stats.totalClients} total</span>
          </div>
          <div className="space-y-3">
            {statusDisplayOrder(stats.clientsByStatus).map((status) => (
              <BarRow
                key={status}
                label={status}
                count={stats.clientsByStatus[status] ?? 0}
                total={stats.totalClients}
                color={STATUS_COLORS[status] ?? "bg-slate-400"}
              />
            ))}
          </div>
        </Card>

        {/* Status dos processos */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Processos por Status</SectionTitle>
            <span className="text-xs text-slate-400">{stats.totalProcesses} total</span>
          </div>
          <div className="space-y-3">
            {statusDisplayOrder(stats.processosByStatus).map((status) => (
              <BarRow
                key={status}
                label={status}
                count={stats.processosByStatus[status] ?? 0}
                total={stats.totalProcesses}
                color={STATUS_COLORS[status] ?? "bg-slate-400"}
              />
            ))}
          </div>

          <hr className="my-4 border-slate-100" />

          <div className="mb-2">
            <SectionTitle>Modelo de Cobrança</SectionTitle>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.byBilling)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <BarRow
                  key={label}
                  label={label}
                  count={count}
                  total={stats.totalProcesses}
                  color="bg-navy-800"
                />
              ))}
          </div>
        </Card>
      </div>

      {/* ── Linha 3: Top parceiros + Indicadores rápidos ────────────────── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">

        {/* Top parceiros por indicações */}
        <Card>
          <SectionTitle>Top Parceiros por Indicações</SectionTitle>
          {stats.topParceiros.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum parceiro vinculado</p>
          ) : (
            <div className="space-y-3">
              {stats.topParceiros.map(([nome, count], i) => (
                <div key={nome} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{nome}</span>
                  <span className="text-sm font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Indicadores rápidos */}
        <Card className="lg:col-span-2">
          <SectionTitle>Indicadores Rápidos</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: "Clientes Ativos",
                value: `${pct(stats.ativos, stats.totalClients)}%`,
                sub: `${stats.ativos} de ${stats.totalClients}`,
                icon: CheckCircle,
                color: "text-emerald-600"
              },
              {
                label: "Sem Processo",
                value: stats.semProcesso,
                sub: "clientes sem processo vinculado",
                icon: AlertCircle,
                color: "text-amber-500"
              },
              {
                label: "Processos Ativos",
                value: stats.processosByStatus["Ativo"] ?? 0,
                sub: `${pct(stats.processosByStatus["Ativo"] ?? 0, stats.totalProcesses)}% dos processos`,
                icon: Activity,
                color: "text-sky-600"
              },
              {
                label: "Em Audiência",
                value: stats.processosByStatus["Audiência"] ?? 0,
                sub: "processos com audiência marcada",
                icon: Clock,
                color: "text-blue-600"
              },
              {
                label: "Em Contratação",
                value: stats.clientsByStatus["Contratação"] ?? 0,
                sub: "clientes aguardando fechar contrato",
                icon: CheckCircle,
                color: "text-amber-600"
              },
              {
                label: "Drive Vinculado",
                value: `${pct(stats.comDrive, stats.totalClients)}%`,
                sub: `${stats.comDrive} de ${stats.totalClients} clientes`,
                icon: FolderOpen,
                color: "text-navy-800"
              }
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={color} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                </div>
                <p className="text-xl font-bold text-slate-900">{value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Linha 4: Últimos clientes + Últimos processos ────────────────── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">

        {/* Últimos clientes cadastrados */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Últimos Clientes Cadastrados</SectionTitle>
            <Link href="/clientes" className="text-xs font-semibold text-navy-800 hover:text-navy-700">
              Ver todos →
            </Link>
          </div>
          {stats.recentClients.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum cliente cadastrado</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentClients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-5 px-5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.document}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos processos */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Últimos Processos</SectionTitle>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <BarChart3 size={12} />
              {stats.totalProcesses} total
            </div>
          </div>
          {stats.recentProcesses.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum processo cadastrado</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentProcesses.map((p) => {
                const client = clients.find(c => c.processIds.includes(p.id));
                return (
                  <Link
                    key={p.id}
                    href={`/processos/${p.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-5 px-5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {p.number === "A definir" ? (p.actionType || "Processo sem número") : p.number}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {client?.name ?? "—"}
                        {p.filingDate ? ` · ${p.filingDate}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
