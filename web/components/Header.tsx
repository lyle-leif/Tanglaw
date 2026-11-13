"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Icons";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/family", label: "Family", match: (p: string) => p.startsWith("/family") },
  { href: "/activity", label: "Public record", match: (p: string) => p.startsWith("/activity") || p.startsWith("/receipt") },
  { href: "/staff", label: "Social worker sign-in", match: (p: string) => p.startsWith("/staff") },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="top">
      <Link href="/" className="brand" aria-label="Tanglaw home">
        <Logo />
        <b>tanglaw</b>
      </Link>
      <nav className="top-nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
        {!path.startsWith("/family") && (
          <Link href="/family" className="btn primary">
            Get Assistance
          </Link>
        )}
      </nav>
    </header>
  );
}
