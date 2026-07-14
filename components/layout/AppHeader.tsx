"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, Users, Menu, X } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DriveSyncStatus } from "@/components/DriveSyncStatus";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users }
];

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <header className="border-b border-navy-800/30 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

        {/* Logo + título */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo-baz.png"
            alt="Boos & Amud Zuin Advogados Associados"
            width={40}
            height={40}
            className="shrink-0 object-contain brightness-0 invert sm:w-[52px] sm:h-[52px]"
          />
          <div>
            <h1 className="text-base font-semibold leading-tight sm:text-xl">
              Base Operacional
            </h1>
            <p className="hidden text-xs text-blue-100/70 sm:block">
              Escritório Boos
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-navy-900">
              NB
            </span>
            Nathalia Boos
          </span>
          <button
            onClick={handleLogout}
            title="Sair"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            <LogOut size={15} />
          </button>
          {/* Hamburguer — só mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white sm:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Status de sincronização do Drive */}
      <div className="border-t border-white/10 px-4 py-1.5 sm:px-6 lg:px-8">
        <DriveSyncStatus textClassName="text-white/50" />
      </div>

      {/* Menu mobile dropdown */}
      {menuOpen && (
        <nav className="border-t border-white/10 bg-navy-900 px-4 pb-4 pt-2 sm:hidden">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-white/60">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-navy-900">
              NB
            </span>
            Nathalia Boos
          </div>
        </nav>
      )}
    </header>
  );
}
