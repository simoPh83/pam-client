"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addPracticeContact,
  assignPractice,
  createPractice,
  getPracticeContactsAction,
  searchPracticesAction,
} from "@/lib/actions";
import type { Practice, PracticeContact } from "@/lib/types";
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
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Centred modal for the assign-practice flow: search the shared register,
 * select or create a practice, optionally review/add its contacts, then save
 * the assignment with a project role and note — all without leaving the
 * project page.
 */
export function AssignPracticeDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Practice[]>([]);
  const [selected, setSelected] = useState<Practice | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [contacts, setContacts] = useState<PracticeContact[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Practice | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced register search while no practice is selected.
  useEffect(() => {
    if (!open || selected) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchPracticesAction(query);
        if (res.ok) setResults(res.data);
        else setError(res.error);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, selected]);

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setCreating(false);
    setNewName("");
    setNewWebsite("");
    setNewNotes("");
    setContacts([]);
    setShowContactForm(false);
    setRole("");
    setNote("");
    setError(null);
    setConflict(null);
  }

  function select(p: Practice) {
    setSelected(p);
    setCreating(false);
    setError(null);
    setConflict(null);
    setContacts([]);
    startTransition(async () => {
      const res = await getPracticeContactsAction(p.id);
      if (res.ok) setContacts(res.data);
    });
  }

  function create() {
    setError(null);
    setConflict(null);
    startTransition(async () => {
      const res = await createPractice({
        name: newName,
        website: newWebsite || null,
        notes: newNotes || null,
      });
      if (res.ok) select(res.data);
      else {
        setError(res.error);
        setConflict(res.conflict ?? null);
      }
    });
  }

  function addContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addPracticeContact(selected.id, {
        name: (fd.get("c_name") as string) || "",
        email: (fd.get("c_email") as string) || null,
        phone: (fd.get("c_phone") as string) || null,
        role: (fd.get("c_role") as string) || null,
        notes: null,
      });
      if (res.ok) {
        setContacts((cs) => [...cs, res.data]);
        setShowContactForm(false);
      } else setError(res.error);
    });
  }

  function assign() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await assignPractice(projectId, selected.id, {
        role: role || null,
        notes: note || null,
      });
      if (res.ok) {
        setOpen(false);
        reset();
      } else setError(res.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Assign practice</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign practice</DialogTitle>
          <DialogDescription>
            Practices and contacts are shared records — visible to and editable
            by everyone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}{" "}
            {conflict && (
              <button
                type="button"
                className="underline"
                onClick={() => select(conflict)}
              >
                Use “{conflict.name}”
              </button>
            )}
          </div>
        )}

        {!selected && !creating && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="practice-search" className="text-xs">
                Search existing practices
              </Label>
              <Input
                id="practice-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Allford Hall Monaghan Morris"
                autoFocus
              />
            </div>
            <ul className="divide-y rounded-md border">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      {p.website && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.website}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      shared record
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {query ? "No matches." : "Type to search the register."}
                </li>
              )}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(true);
                setNewName(query);
              }}
            >
              Create new practice
            </Button>
          </div>
        )}

        {!selected && creating && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-name" className="text-xs">
                Name *
              </Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-website" className="text-xs">
                Website
              </Label>
              <Input
                id="new-website"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-notes" className="text-xs">
                General notes
              </Label>
              <Textarea
                id="new-notes"
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={pending || !newName.trim()}>
                Create and select
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                  setConflict(null);
                }}
              >
                Back to search
              </Button>
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{selected.name}</div>
                  {selected.website && (
                    <a
                      href={selected.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {selected.website} ↗
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setContacts([]);
                  }}
                >
                  Change
                </Button>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Contacts ({contacts.length})
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowContactForm((v) => !v)}
                  >
                    {showContactForm ? "Cancel" : "Add contact"}
                  </Button>
                </div>
                {contacts.length > 0 && (
                  <ul className="mb-2 space-y-1 text-sm">
                    {contacts.map((c) => (
                      <li key={c.id} className="text-xs">
                        <span className="font-medium">{c.name}</span>
                        {c.role && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.role}
                          </span>
                        )}
                        {c.email && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.phone}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {showContactForm && (
                  <form
                    onSubmit={addContact}
                    className="grid grid-cols-2 gap-2 rounded-md border p-2"
                  >
                    <Input name="c_name" placeholder="Name *" required />
                    <Input name="c_role" placeholder="Role" />
                    <Input name="c_email" type="email" placeholder="Email" />
                    <Input name="c_phone" placeholder="Phone" />
                    <Button
                      size="sm"
                      className="col-span-2"
                      disabled={pending}
                    >
                      Save contact
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="assign-role" className="text-xs">
                Role on this project
              </Label>
              <Input
                id="assign-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. main architect, landscape architect…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assign-note" className="text-xs">
                Project note
              </Label>
              <Textarea
                id="assign-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              onClick={assign}
              disabled={pending}
              className="w-full"
            >
              Assign to project
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
