"use client";

import { useState, useTransition } from "react";
import {
  addPracticeContact,
  deletePractice,
  deletePracticeContact,
  unassignPractice,
  updatePractice,
  updatePracticeContact,
  updateProjectPractice,
} from "@/lib/actions";
import type { PracticeContact, ProjectPractice } from "@/lib/types";
import { AssignPracticeDialog } from "@/components/assign-practice-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Project-level list of assigned practices (shared register records). Lives
 * in the persistent project context of the project page; edits are visible
 * to all users.
 */
export function PracticesSection({
  projectId,
  assignments,
}: {
  projectId: number;
  assignments: ProjectPractice[];
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Practices{" "}
          <span className="font-normal text-muted-foreground">
            ({assignments.length}) · shared
          </span>
        </h2>
        <AssignPracticeDialog projectId={projectId} />
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No verified practices assigned yet. Check the PlanIt agents block,
          verify against the application documents, then assign.
        </p>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => (
            <PracticeCard key={a.id} assignment={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PracticeCard({ assignment }: { assignment: ProjectPractice }) {
  const { practice, contacts } = assignment;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState(false);
  const [role, setRole] = useState(assignment.role ?? "");
  const [note, setNote] = useState(assignment.notes ?? "");
  const [showContacts, setShowContacts] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) onOk?.();
      else setError(res.error ?? "Save failed");
    });
  }

  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{practice.name}</span>
            {assignment.role && (
              <Badge variant="secondary">{assignment.role}</Badge>
            )}
          </div>
          {practice.website && (
            <a
              href={practice.website}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              {practice.website} ↗
            </a>
          )}
          {assignment.notes && !editingLink && (
            <p className="mt-1 text-xs text-muted-foreground">
              {assignment.notes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setShowContacts((v) => !v)}
          >
            Contacts ({contacts.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setEditingLink((v) => !v)}
          >
            {editingLink ? "Cancel" : "Edit role/note"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setEditOpen(true)}
          >
            Edit practice
          </Button>
          <Button
            size="sm"
            variant={confirmUnassign ? "destructive" : "outline"}
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() => {
              if (!confirmUnassign) {
                setConfirmUnassign(true);
                return;
              }
              run(() => unassignPractice(assignment.id));
            }}
            onBlur={() => setConfirmUnassign(false)}
          >
            {confirmUnassign ? "Confirm unassign?" : "Unassign"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {editingLink && (
        <form
          className="mt-3 space-y-2 rounded-md border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                updateProjectPractice(assignment.id, {
                  role: role || null,
                  notes: note || null,
                }),
              () => setEditingLink(false)
            );
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Role on this project</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. main architect, landscape architect…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Project note</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={pending}>
            Save assignment
          </Button>
        </form>
      )}

      {showContacts && (
        <ContactsPanel practiceId={practice.id} contacts={contacts} />
      )}

      <EditPracticeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        practice={practice}
      />
    </li>
  );
}

function ContactsPanel({
  practiceId,
  contacts,
}: {
  practiceId: string;
  contacts: PracticeContact[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) onOk?.();
      else setError(res.error ?? "Save failed");
    });
  }

  function contactFields(fd: FormData) {
    return {
      name: ((fd.get("name") as string) ?? "").trim(),
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      role: (fd.get("role") as string) || null,
      notes: null,
    };
  }

  return (
    <div className="mt-3 rounded-md border p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Contacts — shared with the practice everywhere
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
          }}
        >
          {adding ? "Cancel" : "Add contact"}
        </Button>
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {contacts.length > 0 && (
        <ul className="mb-2 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="text-xs">
              {editingId === c.id ? (
                <form
                  className="grid grid-cols-2 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    run(
                      () => updatePracticeContact(c.id, contactFields(fd)),
                      () => setEditingId(null)
                    );
                  }}
                >
                  <Input name="name" defaultValue={c.name} placeholder="Name *" required />
                  <Input name="role" defaultValue={c.role ?? ""} placeholder="Role" />
                  <Input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Email" />
                  <Input name="phone" defaultValue={c.phone ?? ""} placeholder="Phone" />
                  <div className="col-span-2 flex gap-2">
                    <Button size="sm" disabled={pending}>Save</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.role && (
                      <span className="text-muted-foreground"> · {c.role}</span>
                    )}
                    {c.email && (
                      <>
                        {" · "}
                        <a href={`mailto:${c.email}`} className="hover:underline">
                          {c.email}
                        </a>
                      </>
                    )}
                    {c.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${c.phone}`} className="hover:underline">
                          {c.phone}
                        </a>
                      </>
                    )}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => {
                        setEditingId(c.id);
                        setAdding(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={confirmDeleteId === c.id ? "destructive" : "ghost"}
                      className="h-6 px-1.5 text-[11px]"
                      disabled={pending}
                      onClick={() => {
                        if (confirmDeleteId !== c.id) {
                          setConfirmDeleteId(c.id);
                          return;
                        }
                        run(() => deletePracticeContact(c.id));
                      }}
                      onBlur={() => setConfirmDeleteId(null)}
                    >
                      {confirmDeleteId === c.id ? "Confirm?" : "Delete"}
                    </Button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(
              () => addPracticeContact(practiceId, contactFields(fd)),
              () => setAdding(false)
            );
          }}
        >
          <Input name="name" placeholder="Name *" required />
          <Input name="role" placeholder="Role" />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="phone" placeholder="Phone" />
          <Button size="sm" className="col-span-2" disabled={pending}>
            Save contact
          </Button>
        </form>
      )}
    </div>
  );
}

function EditPracticeDialog({
  open,
  onOpenChange,
  practice,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  practice: ProjectPractice["practice"];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await updatePractice(practice.id, {
        name: (fd.get("name") as string) || "",
        website: (fd.get("website") as string) || null,
        notes: (fd.get("notes") as string) || null,
      });
      if (res.ok) onOpenChange(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setError(null);
          setConfirmDelete(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit practice</DialogTitle>
          <DialogDescription>
            Shared record — changes apply everywhere this practice appears.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ep-name" className="text-xs">
              Name *
            </Label>
            <Input id="ep-name" name="name" defaultValue={practice.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-website" className="text-xs">
              Website
            </Label>
            <Input
              id="ep-website"
              name="website"
              defaultValue={practice.website ?? ""}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-notes" className="text-xs">
              General notes
            </Label>
            <Textarea
              id="ep-notes"
              name="notes"
              rows={3}
              defaultValue={practice.notes ?? ""}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={pending}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                setError(null);
                startTransition(async () => {
                  const res = await deletePractice(practice.id);
                  if (res.ok) onOpenChange(false);
                  else setError(res.error);
                });
              }}
            >
              {confirmDelete ? "Confirm delete?" : "Delete practice"}
            </Button>
            <Button size="sm" disabled={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
