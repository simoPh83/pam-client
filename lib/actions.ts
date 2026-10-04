"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function updateLeadMeta(
  uid: string,
  input: { starred?: boolean; hidden?: boolean; notes?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("ui_lead_meta").upsert(
    {
      uid,
      ...(input.starred !== undefined ? { starred: input.starred } : {}),
      ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_by: user.id,
    },
    { onConflict: "uid" }
  );
  if (error) throw new Error(error.message);

  revalidatePath("/lead");
  revalidatePath("/");
}
