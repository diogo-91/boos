"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  Handshake,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  BarChart3,
  Calendar,
  Activity
} from "lucide-react";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { StatusBadge } from "@/components/StatusBadge";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-soft ${className}`}>
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
    const sarandiIptu = clientsByStatus["Sarandi/IPTU"] ?? 0;
    const emContratacao = clientsByStatus["Em contratação"] ?? 0;
    const dativos = clientsByStatus["Dativo"] ?? 0;
    const parceiros_status = clientsByStatus["Parceiros"] ?? 0;
    const arquivados = clientsByStatus["Arquivado"] ?? 0;
    const cancelados = clientsByStatus["Cancelado"] ?? 0;

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

    // ── % êxito médio ─────────────────────────────────────────────────────────
    const withFee = processes.filter(p => p.successFee && p.successFee !== "—");
    const avgFee =
      withFee.length > 0
        ? Math.round(
            withFee.reduce((acc, p) => {
              const n = parseFloat(p.successFee.replace("%", ""));
              return acc + (isNaN(n) ? 0 : n);
            }, 0) / withFee.length
          )
        : null;

    return {
      totalClients: clients.length,
      totalProcesses: processes.length,
      totalParceiros: Object.keys(parceiroMap).length,
      ativos,
      sarandiIptu,
      emContratacao,
      dativos,
      parceiros_status,
      arquivados,
      cancelados,
      processosByStatus,
      byBilling,
      topParceiros,
      semProcesso,
      comDrive,
      recentProcesses,
      recentClients,
      avgFee,
      withFee: withFee.length
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
    <section className="space-y-6">

      {/* ── KPIs principais ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total de clientes"
          value={stats.totalClients}
          sub={`${stats.comDrive} com Drive vinculado`}
          icon={Users}
          color="bg-navy-800"
        />
        <KpiCard
          label="Total de processos"
          value={stats.totalProcesses}
          sub={`${stats.semProcesso} clientes sem processo`}
          icon={FileText}
          color="bg-emerald-600"
        />
        <KpiCard
          label="Parceiros ativos"
          value={stats.totalParceiros}
          sub="com indicações vinculadas"
          icon={Handshake}
          color="bg-sky-600"
        />
        <KpiCard
          label="% êxito médio"
          value={stats.avgFee !== null ? `${stats.avgFee}%` : "—"}
          sub={stats.avgFee !== null ? `baseado em ${stats.withFee} processos` : "nenhum processo com %"}
          icon={TrendingUp}
          color="bg-violet-600"
        />
      </div>

      {/* ── Linha 2: Status clientes + Status processos ──────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Status dos clientes */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Clientes por status</SectionTitle>
            <span className="text-xs text-slate-400">{stats.totalClients} total</span>
          </div>
          <div className="space-y-3">
            <BarRow label="Ativo" count={stats.ativos} total={stats.totalClients} color="bg-emerald-500" />
            <BarRow label="Sarandi/IPTU" count={stats.sarandiIptu} total={stats.totalClients} color="bg-orange-400" />
            <BarRow label="Em contratação" count={stats.emContratacao} total={stats.totalClients} color="bg-amber-400" />
            <BarRow label="Dativo" count={stats.dativos} total={stats.totalClients} color="bg-purple-500" />
            <BarRow label="Parceiros" count={stats.parceiros_status} total={stats.totalClients} color="bg-sky-500" />
            <BarRow label="Arquivado" count={stats.arquivados} total={stats.totalClients} color="bg-slate-400" />
            <BarRow label="Cancelado" count={stats.cancelados} total={stats.totalClients} color="bg-red-400" />
          </div>
        </Card>

        {/* Status dos processos */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Processos por status</SectionTitle>
            <span className="text-xs text-slate-400">{stats.totalProcesses} total</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Em andamento", color: "bg-emerald-500" },
              { label: "Aguard. documentos", color: "bg-yellow-400" },
              { label: "Aguard. audiência", color: "bg-blue-500" },
              { label: "Acordado", color: "bg-violet-500" },
              { label: "Encerrado", color: "bg-slate-400" }
            ].map(({ label, color }) => (
              <BarRow
                key={label}
                label={label}
                count={stats.processosByStatus[label] ?? 0}
                total={stats.totalProcesses}
                color={color}
              />
            ))}
          </div>

          <hr className="my-4 border-slate-100" />

          <div className="mb-2">
            <SectionTitle>Modelo de cobrança</SectionTitle>
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
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Top parceiros por indicações */}
        <Card>
          <SectionTitle>Top parceiros por indicações</SectionTitle>
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
          <SectionTitle>Indicadores rápidos</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: "Clientes ativos",
                value: `${pct(stats.ativos, stats.totalClients)}%`,
                sub: `${stats.ativos} de ${stats.totalClients}`,
                icon: CheckCircle,
                color: "text-emerald-600"
              },
              {
                label: "Sem processo",
                value: stats.semProcesso,
                sub: "clientes sem processo vinculado",
                icon: AlertCircle,
                color: "text-amber-500"
              },
              {
                label: "Em andamento",
                value: stats.processosByStatus["Em andamento"] ?? 0,
                sub: `${pct(stats.processosByStatus["Em andamento"] ?? 0, stats.totalProcesses)}% dos processos`,
                icon: Activity,
                color: "text-sky-600"
              },
              {
                label: "Aguard. documentos",
                value: stats.processosByStatus["Aguard. documentos"] ?? 0,
                sub: "processos aguardando",
                icon: Clock,
                color: "text-yellow-600"
              },
              {
                label: "Acordados",
                value: stats.processosByStatus["Acordado"] ?? 0,
                sub: `${pct(stats.processosByStatus["Acordado"] ?? 0, stats.totalProcesses)}% dos processos`,
                icon: CheckCircle,
                color: "text-violet-600"
              },
              {
                label: "Drive vinculado",
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
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Últimos clientes cadastrados */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Últimos clientes cadastrados</SectionTitle>
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
            <SectionTitle>Últimos processos</SectionTitle>
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

      {/* ── Rodapé: data de atualização ─────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Calendar size={12} />
        Dados atualizados em tempo real via Supabase
      </div>
    </section>
  );
}
