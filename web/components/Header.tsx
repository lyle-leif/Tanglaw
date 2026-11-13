"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Icons";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/student", label: "Student", match: (p: string) => p.startsWith("/student") },
  { href: "/activity", label: "Public record", match: (p: string) => p.startsWith("/activity") || p.startsWith("/receipt") },
  { href: "/staff", label: "Scholarship officer sign-in", match: (p: string) => p.startsWith("/staff") },
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
        {!path.startsWith("/student") && (
          <Link href="/student" className="btn primary">
            Get Assistance
          </Link>
        )}
      </nav>
    </header>
  );
}
