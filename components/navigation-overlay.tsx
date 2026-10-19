"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const NavigationContext = createContext<(href: string) => void>(() => {});

/** router.push that keeps the page-wide loading overlay up until it lands. */
export function useNavigate() {
  return useContext(NavigationContext);
}

/** Clears the link-click flag once the URL actually changes. */
function LocationWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    onChange();
  }, [pathname, search, onChange]);
  return null;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkClicked, setLinkClicked] = useState(false);

  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router]
  );
  const clear = useCallback(() => setLinkClicked(false), []);

  // Any plain click on an internal <a> (nav menu, table links, tabs).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download"))
        return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search)
        return;
      setLinkClicked(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Safety net so the overlay can never get stuck.
  useEffect(() => {
    if (!linkClicked) return;
    const t = setTimeout(clear, 20000);
    return () => clearTimeout(t);
  }, [linkClicked, clear]);

  const loading = pending || linkClicked;

  return (
    <NavigationContext.Provider value={navigate}>
      <Suspense fallback={null}>
        <LocationWatcher onChange={clear} />
      </Suspense>
      {children}
      {loading && (
        <div
          role="status"
          aria-label="Loading page"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
        >
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </NavigationContext.Provider>
  );
}
