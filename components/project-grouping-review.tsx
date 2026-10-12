"use client";

import Link from "next/link";
import type { GroupingReviewCandidate, Project, ProjectGroupingReview } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { GroupingResolutionButton } from "@/components/grouping-resolution-button";

function CandidateDetails({
  candidate,
}: {
  candidate: GroupingReviewCandidate;
}) {
  const title = candidate.uid ? (
    <Link
      href={`/lead?uid=${encodeURIComponent(candidate.uid)}`}
      className="font-medium hover:underline"
    >
      {candidate.uid}
    </Link>
  ) : (
    <span className="font-medium">Candidate scheme</span>
  );

  return (
    <div className="min-w-0 rounded-md border bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {title}
        {candidate.app_type && (
          <Badge variant="outline">{candidate.app_type}</Badge>
        )}
        {candidate.grouping_state && candidate.grouping_state !== "clean" && (
          <Badge variant="secondary">{candidate.grouping_state}</Badge>
        )}
      </div>
      {candidate.address && (
        <p className="mt-1 text-xs text-muted-foreground">
          {candidate.address}
        </p>
      )}
      {candidate.description && (
        <p className="mt-1 text-sm text-muted-foreground">
          {candidate.description}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Filed {formatDate(candidate.start_date)}
        {candidate.n_applications != null
          ? ` · ${candidate.n_applications} applications`
          : ""}
      </p>
    </div>
  );
}

export function ProjectGroupingReview({
  project,
  reviews,
  derivedCandidates = [],
}: {
  project: Project;
  reviews: ProjectGroupingReview[];
  derivedCandidates?: GroupingReviewCandidate[];
}) {
  const multiRootReviews = reviews.filter(
    (review) => review.reason === "multi_root"
  );
  const unlinkedReviews = reviews.filter(
    (review) => review.reason === "unlinked_multi_scheme"
  );

  if (
    project.grouping_state === "clean" &&
    multiRootReviews.length === 0 &&
    unlinkedReviews.length === 0
  ) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Scheme grouping status">
      {project.grouping_state === "provisional" && (
        <div className="rounded-md border border-zinc-300 bg-muted/30 px-4 py-3">
          <Badge variant="secondary">Incomplete chain</Badge>
          <p className="mt-1 text-sm text-muted-foreground">
            This scheme has a provisional root because part of its parent
            reference chain is not yet established.
          </p>
        </div>
      )}

      {project.grouping_state === "ambiguous" &&
        (multiRootReviews.length ? (
          multiRootReviews.map((review) => (
            <div
              key={review.id}
              className="space-y-3 rounded-md border border-amber-400/70 bg-amber-50/60 p-4 dark:bg-amber-950/20"
            >
              <div>
                <Badge className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                  Multiple schemes
                </Badge>
                <p className="mt-2 text-sm font-medium">
                  This address contains {review.candidates.length} candidate
                  schemes.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  These roots are currently kept together as one project. Most
                  multi-root groups are one evolving scheme and can be left as
                  they are.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {review.candidates.map((candidate, index) => (
                  <CandidateDetails
                    key={`${candidate.project_id}-${candidate.uid ?? index}`}
                    candidate={candidate}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <GroupingResolutionButton
                  reviewId={review.id}
                  resolution="merged"
                  label="Keep as one scheme"
                  variant="secondary"
                />
                <p className="max-w-xl text-xs text-muted-foreground">
                  Splitting these roots requires worker-side handling and is
                  not available through the current review action.
                </p>
              </div>
            </div>
          ))
        ) : derivedCandidates.length ? (
          <div className="space-y-3 rounded-md border border-amber-400/70 bg-amber-50/60 p-4 dark:bg-amber-950/20">
            <div>
              <Badge className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                Multiple schemes
              </Badge>
              <p className="mt-2 text-sm font-medium">
                This address contains {derivedCandidates.length} candidate
                schemes.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                These roots are currently kept together as one project. Most
                multi-root groups are one evolving scheme and can be left as
                they are.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {derivedCandidates.map((candidate, index) => (
                <CandidateDetails
                  key={`${candidate.project_id}-${candidate.uid ?? index}`}
                  candidate={candidate}
                />
              ))}
            </div>
            <p className="max-w-xl text-xs text-muted-foreground">
              Grouping actions for this project become available once the
              worker syncs a review for it.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-amber-400/70 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
            <Badge className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
              Multiple schemes
            </Badge>
            <p className="mt-2 text-sm">
              This address contains multiple candidate schemes. Review details
              are not currently available.
            </p>
          </div>
        ))}

      {unlinkedReviews.length > 0 && (
        <div className="space-y-3 rounded-md border border-sky-300/70 bg-sky-50/50 p-4 dark:bg-sky-950/15">
          <p className="text-sm font-medium">
            {unlinkedReviews.length} application
            {unlinkedReviews.length === 1 ? "" : "s"} at this address{" "}
            {unlinkedReviews.length === 1 ? "isn't" : "aren't"} linked to a
            scheme yet.
          </p>
          {unlinkedReviews.map((review) => (
            <article
              key={review.id}
              className="space-y-3 rounded-md border bg-background/70 p-3"
            >
              <div>
                {review.orphan?.description && (
                  <p className="text-sm text-muted-foreground">
                    {review.orphan.description}
                  </p>
                )}
                {review.orphan?.uid && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {review.orphan.reference ?? review.orphan.uid}
                    {review.orphan.app_type ? ` · ${review.orphan.app_type}` : ""}
                    {review.orphan.start_date
                      ? ` · ${formatDate(review.orphan.start_date)}`
                      : ""}
                  </p>
                )}
              </div>
              <ul className="space-y-2">
                {review.candidates.map((candidate, index) => (
                  <li
                    key={`${candidate.project_id}-${candidate.uid ?? index}`}
                    className="flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <CandidateDetails candidate={candidate} />
                    </div>
                    {Number(candidate.project_id) === project.id && (
                      <GroupingResolutionButton
                        reviewId={review.id}
                        resolution={String(project.id)}
                        label="Assign to this scheme"
                        variant="secondary"
                      />
                    )}
                  </li>
                ))}
              </ul>
              <GroupingResolutionButton
                reviewId={review.id}
                resolution="dismiss"
                label="Dismiss"
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
