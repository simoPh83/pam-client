"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Leads" },
  { href: "/outreach", label: "Outreach" },
  { href: "/status", label: "Status" },
];

const STORAGE_KEY = "pam:leads-search";

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [saved, setSaved] = useState("");

  // Remember the Leads filters while on the homepage; restore them elsewhere.
  useEffect(() => {
    if (pathname === "/") {
      sessionStorage.setItem(STORAGE_KEY, search);
      setSaved(search);
    } else {
      setSaved(sessionStorage.getItem(STORAGE_KEY) ?? "");
    }
  }, [pathname, search]);

  return (
    <nav className="flex gap-4 text-sm">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href === "/" && saved ? `/?${saved}` : n.href}
          className="text-muted-foreground hover:text-foreground"
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
