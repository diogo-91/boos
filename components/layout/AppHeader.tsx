"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, Users } from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users }
];

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-navy-800/30 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/dashboard">
            <Image
              src="/logo-baz.png"
              alt="Boos & Amud Zuin Advogados Associados"
              width={120}
              height={120}
              className="shrink-0 object-contain brightness-0 invert"
            />
          </Link>
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
              Base Operacional
            </h1>
            <p className="text-sm text-blue-100/70">
              Consulta operacional por cliente, status, cobrança, parceiro e processo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Navegação */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Usuário */}
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-navy-900">
              NB
            </span>
            <span className="hidden sm:inline">Nathalia Boos</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
