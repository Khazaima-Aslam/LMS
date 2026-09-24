"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/search", label: "Search Leads", icon: "⌕" },
  { href: "/setup", label: "Setup", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

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
          const active = pathname === link.href;
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
