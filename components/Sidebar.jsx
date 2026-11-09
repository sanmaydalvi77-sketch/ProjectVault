
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { label: "Overview", href: "/", icon: "⌂" },
  { label: "My Projects", href: "/projects", icon: "▣" },
  { label: "Documents", href: "/documents", icon: "▤" },
  { label: "Knowledge Ledger", href: "/knowledge", icon: "◈" },
  { label: "Handover Reports", href: "/reports", icon: "▧" },
];

export default function Sidebar({ onLogout }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(item) {
    if (item.href === "/") return pathname === "/";

    if (item.href === "/projects") {
      return pathname === "/projects" ||
        (pathname.startsWith("/projects/") &&
          !pathname.includes("/documents") &&
          !pathname.includes("/knowledge") &&
          !pathname.includes("/reports"));
    }

    return pathname === item.href ||
      pathname.startsWith(item.href + "/");
  }

  function NavigationLinks() {
    return navigation.map((item) => {
      const active = isActive(item);

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
            active
              ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
              : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
          }`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg">
            {item.icon}
          </span>
          {item.label}
          {active && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
          )}
        </Link>
      );
    });
  }

  function AccountLinks({ mobile = false }) {
    return (
      <div className="shrink-0 border-t border-slate-800 pt-4">
        <Link
          href="/settings"
          onClick={() => mobile && setMobileOpen(false)}
          className={`mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
            pathname === "/settings"
              ? "bg-blue-500/10 text-blue-400"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span>⚙</span>
          Settings
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-red-400 transition hover:bg-red-500/10"
        >
          <span>↪</span>
          Log out
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-5 md:hidden">
        <Link href="/" className="text-xl font-bold text-white">
          Project<span className="text-blue-500">Vault</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕ Close" : "☰ Menu"}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col overflow-y-auto border-r border-slate-800/80 bg-slate-950 p-6 text-white md:flex">
        <Link href="/" className="mb-10 block shrink-0 px-2 pt-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Project<span className="text-blue-500">Vault</span>
            <span className="ml-2 rounded-md bg-blue-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-400">
              AI
            </span>
          </h1>
          <p className="mt-2 text-xs tracking-wide text-slate-500">
            PROJECT KNOWLEDGE WORKSPACE
          </p>
        </Link>

        <p className="mb-4 shrink-0 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
          Workspace
        </p>

        <nav className="min-h-0 flex-1 space-y-2">
          <NavigationLinks />
        </nav>

        <AccountLinks />
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950 pt-20 text-white md:hidden">
          <div className="flex min-h-full flex-col p-5">
            <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              Workspace
            </p>

            <nav className="flex-1 space-y-2">
              <NavigationLinks />
            </nav>

            <div className="mt-6">
              <AccountLinks mobile />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
