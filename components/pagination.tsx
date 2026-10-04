import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  makeHref,
}: {
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild disabled={page <= 1}>
        <Link href={makeHref(page - 1)} aria-disabled={page <= 1}>
          ← Prev
        </Link>
      </Button>
      <span className="text-xs">
        Page {page} of {pageCount}
      </span>
      <Button variant="outline" size="sm" asChild disabled={page >= pageCount}>
        <Link href={makeHref(page + 1)} aria-disabled={page >= pageCount}>
          Next →
        </Link>
      </Button>
    </div>
  );
}
