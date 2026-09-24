"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ManagedRole } from "@/lib/managedUsers";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/search", label: "Search Leads", icon: "⌕" },
  { href: "/setup", label: "My Connections", icon: "⚙" },
];

const adminLinks = [
  { href: "/admin/users", label: "User Accounts", icon: "♙" },
];

export default function Sidebar({ role }: { role: ManagedRole }) {
  const pathname = usePathname();
  const links = role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">L</div>
        <div>
          <div className="brandName">LEADFLOW</div>
          <div className="brandSub">BUSINESS LEADS</div>
        </div>
      </div>

      <nav className="nav">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`navItem ${active ? "active" : ""}`}
            >
              <span className="navIcon">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebarFoot">
        <div className="privacyDot" />
        Public business data only
      </div>
    </aside>
  );
}
