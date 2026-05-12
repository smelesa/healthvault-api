"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: "◉" },
  { href: "/dashboard/upload", label: "Upload", icon: "↑" },
  { href: "/dashboard/documents", label: "Documents", icon: "≡" },
  { href: "/dashboard/analyze", label: "Analyze", icon: "◎" },
  { href: "/dashboard/coach", label: "Coach", icon: "💜" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r bg-white dark:bg-zinc-900">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-black dark:text-white">HealthVault</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}