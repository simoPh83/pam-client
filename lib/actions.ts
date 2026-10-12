"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ManualResolveOutcome,
  Practice,
  PracticeContact,
  SchemeCandidate,
} from "@/lib/types";
import { getSameAddressSchemes, getSamePostcodeSchemes } from "@/lib/queries";
import { normaliseManualRef, validateManualRef } from "@/lib/manual-ref";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string; conflict?: Practice };

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function addOutreachEntry(
  uid: string,
  input: {
    channel: string | null;
    to_name: string | null;
    to_email: string | null;
    status: string;
    follow_up_on: string | null;
    notes: string | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("ui_outreach").insert({
    uid,
    channel: input.channel,
    to_name: input.to_name,
    to_email: input.to_email,
    status: input.status,
    follow_up_on: input.follow_up_on || null,
    notes: input.notes,
    created_by: user.id,
    created_by_email: user.email ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/lead");
  revalidatePath("/outreach");
}

export async function toggleProjectStar(projectId: number, starred: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (starred) {
    const { error } = await supabase
      .from("ui_project_stars")
      .upsert({ project_id: projectId }, { onConflict: "user_id,project_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("ui_project_stars")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/lead");
  revalidatePath("/");
}

export async function applyGroupingResolution(
  reviewId: number,
  resolution: string
): Promise<{ ok: true; action: string | null } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
    return { ok: false, error: "Invalid grouping review." };
  }
  if (
    resolution !== "merged" &&
    resolution !== "dismiss" &&
    resolution !== "split" &&
    !/^[1-9]\d*$/.test(resolution)
  ) {
    return { ok: false, error: "Invalid grouping resolution." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return { ok: false, error: authError.message };
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("apply_grouping_resolution", {
    p_review_id: reviewId,
    p_resolution: resolution,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/lead");
  const action =
    data && typeof data === "object" && "action" in data
      ? String((data as { action: unknown }).action)
      : null;
  return { ok: true, action };
}

function refreshGroupingViews() {
  revalidatePath("/");
  revalidatePath("/lead");
}

export async function resolveReviewWithRef(
  reviewId: number,
  reference: string
): Promise<
  | { ok: true; outcome: ManualResolveOutcome }
  | { ok: false; error: string }
> {
  if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
    return { ok: false, error: "Invalid grouping review." };
  }
  const ref = normaliseManualRef(reference);
  const invalid = validateManualRef(ref);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_review_with_ref", {
    p_review_id: reviewId,
    p_reference: ref,
  });
  if (error) return { ok: false, error: error.message };

  const payload = (data ?? {}) as {
    action?: string;
    project_id?: number | string | null;
    reference?: string | null;
  };
  refreshGroupingViews();
  const reference_ = payload.reference ?? ref;
  switch (payload.action) {
    case "linked":
      return {
        ok: true,
        outcome: {
          action: "linked",
          project_id:
            payload.project_id != null ? Number(payload.project_id) : null,
          reference: reference_,
        },
      };
    case "queued_for_hunt":
      return {
        ok: true,
        outcome: { action: "queued_for_hunt", reference: reference_ },
      };
    case "exhausted":
      return {
        ok: true,
        outcome: { action: "exhausted", reference: reference_ },
      };
    default:
      return { ok: false, error: "Unexpected response from the server." };
  }
}

export async function resolveReviewSingleton(
  reviewId: number
): Promise<{ ok: true; projectId: number | null } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
    return { ok: false, error: "Invalid grouping review." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_review_singleton", {
    p_review_id: reviewId,
  });
  if (error) return { ok: false, error: error.message };
  refreshGroupingViews();
  const projectId =
    data && typeof data === "object" && "project_id" in data
      ? Number((data as { project_id: unknown }).project_id)
      : null;
  return { ok: true, projectId: Number.isFinite(projectId) ? projectId : null };
}

export async function getSameAddressSchemesAction(
  authority: string,
  addressKey: string | null
): Promise<Result<SchemeCandidate[]>> {
  try {
    return { ok: true, data: await getSameAddressSchemes(authority, addressKey) };
  } catch (e) {
    return fail(e, "Could not load schemes.");
  }
}

export async function getSamePostcodeSchemesAction(
  uid: string,
  page: number
): Promise<Result<{ schemes: SchemeCandidate[]; hasMore: boolean }>> {
  try {
    return { ok: true, data: await getSamePostcodeSchemes(uid, page) };
  } catch (e) {
    return fail(e, "Could not load schemes.");
  }
}

// ---------------------------------------------------------------------------
// Practices (shared register — see docs/2026-10-08-practices-integration-brief.md)
// These actions return result objects instead of throwing so the UI can show
// validation/duplicate errors explicitly.
// ---------------------------------------------------------------------------

export async function searchPracticesAction(
  query: string
): Promise<Result<Practice[]>> {
  const supabase = await createClient();
  const like = `%${query.replace(/[%,()]/g, " ")}%`;
  const { data, error } = await supabase
    .from("ui_practices")
    .select("*")
    .ilike("name", like)
    .order("name", { ascending: true })
    .limit(10);
  if (error) return fail(error.message, "Search failed");
  return { ok: true, data: (data ?? []) as Practice[] };
}

export async function getPracticeContactsAction(
  practiceId: string
): Promise<Result<PracticeContact[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ui_practice_contacts")
    .select("*")
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, "Could not load contacts");
  return { ok: true, data: (data ?? []) as PracticeContact[] };
}

export async function createPractice(input: {
  name: string;
  website: string | null;
  notes: string | null;
}): Promise<Result<Practice>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Practice name is required" };

  const { data, error } = await supabase
    .from("ui_practices")
    .insert({
      name,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: user.id,
      created_by_email: user.email ?? null,
    })
    .select()
    .single();
  if (error) {
    // Case-insensitive unique violation on lower(name): offer the existing record.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("ui_practices")
        .select("*")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      return {
        ok: false,
        error: `A practice named “${name}” already exists`,
        conflict: (existing ?? undefined) as Practice | undefined,
      };
    }
    return fail(error.message, "Could not create practice");
  }

  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true, data: data as Practice };
}

export async function updatePractice(
  id: string,
  input: { name: string; website: string | null; notes: string | null }
): Promise<Result<Practice>> {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Practice name is required" };

  const { data, error } = await supabase
    .from("ui_practices")
    .update({
      name,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: `A practice named “${name}” already exists` };
    return fail(error.message, "Could not update practice");
  }

  revalidatePath("/lead");
  return { ok: true, data: data as Practice };
}

export async function deletePractice(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("ui_practices").delete().eq("id", id);
  if (error) {
    // FK restrict on ui_project_practices.practice_id.
    if (error.code === "23503")
      return {
        ok: false,
        error:
          "This practice is still assigned to projects — unassign it first",
      };
    return fail(error.message, "Could not delete practice");
  }

  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true };
}

export async function addPracticeContact(
  practiceId: string,
  input: {
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    notes: string | null;
  }
): Promise<Result<PracticeContact>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Contact name is required" };

  const { data, error } = await supabase
    .from("ui_practice_contacts")
    .insert({
      practice_id: practiceId,
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: input.role?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: user.id,
      created_by_email: user.email ?? null,
    })
    .select()
    .single();
  if (error) return fail(error.message, "Could not add contact");

  revalidatePath("/lead");
  return { ok: true, data: data as PracticeContact };
}

export async function updatePracticeContact(
  id: string,
  input: {
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    notes: string | null;
  }
): Promise<Result<PracticeContact>> {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Contact name is required" };

  const { data, error } = await supabase
    .from("ui_practice_contacts")
    .update({
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: input.role?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return fail(error.message, "Could not update contact");

  revalidatePath("/lead");
  return { ok: true, data: data as PracticeContact };
}

export async function deletePracticeContact(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_practice_contacts")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message, "Could not delete contact");

  revalidatePath("/lead");
  return { ok: true };
}

export async function assignPractice(
  projectId: number,
  practiceId: string,
  input: { role: string | null; notes: string | null }
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("ui_project_practices").insert({
    project_id: projectId,
    practice_id: practiceId,
    role: input.role?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: user.id,
    created_by_email: user.email ?? null,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "This practice is already assigned to the project" };
    return fail(error.message, "Could not assign practice");
  }

  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectPractice(
  id: string,
  input: { role: string | null; notes: string | null }
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_project_practices")
    .update({
      role: input.role?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (error) return fail(error.message, "Could not update assignment");

  revalidatePath("/lead");
  return { ok: true };
}

export async function unassignPractice(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_project_practices")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message, "Could not unassign practice");

  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectMeta(
  projectId: number,
  input: { hidden?: boolean; notes?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("ui_project_meta").upsert(
    {
      project_id: projectId,
      ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    { onConflict: "user_id,project_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath("/lead");
  revalidatePath("/");
}
