"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Icons";

const AREAS = [
  { prefix: "/family", label: "Family" },
  { prefix: "/staff", label: "Social worker" },
  { prefix: "/activity", label: "Public record" },
];

export function Header() {
  const path = usePathname();
  const area = AREAS.find((a) => path.startsWith(a.prefix));
  return (
    <header className="top">
      <Link href="/" className="brand" aria-label="Tanglaw home">
        <Logo />
        <div>
          <b>Tanglaw</b>
          <small>A light for every peso</small>
        </div>
      </Link>
      {area && <span className="pill gray">{area.label}</span>}
      {!path.startsWith("/activity") && (
        <Link href="/activity" className="top-link">
          Public record
        </Link>
      )}
    </header>
  );
}
