"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, ChevronDown, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sameFilters, type Surface } from "@/lib/saved-views";

type View = {
  id: string;
  name: string;
  shared: boolean;
  filters: Record<string, string>;
  ownedByMe: boolean;
  ownerName: string | null;
  href: string;
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? "Something went wrong. Try again.";
  } catch {
    return "Something went wrong. Try again.";
  }
}

/**
 * Saved views for one page: apply a view (it is just a link to the page with
 * the view's filters), save the filters currently set, share with the
 * organisation (editors and admins), delete. The server decides every rule;
 * this only hides what the caller cannot do.
 */
export function SavedViewsMenu({
  orgId,
  surface,
  filters,
  canShare,
  isAdmin,
}: {
  orgId: string;
  surface: Surface;
  /** The filters the page has set right now (see activeFilters). */
  filters: Record<string, string>;
  canShare: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ["saved-views", orgId, surface];
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: views = [], isError } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<View[]> => {
      const res = await fetch(`/api/orgs/${orgId}/saved-views?surface=${surface}`);
      if (!res.ok) throw new Error(await readError(res));
      return ((await res.json()) as { views: View[] }).views;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/saved-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, name, filters, shared: canShare && shared }),
      });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      setSaving(false);
      setName("");
      setShared(false);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orgs/${orgId}/saved-views/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const mine = views.filter((v) => !v.shared);
  const sharedViews = views.filter((v) => v.shared);
  const hasFilters = Object.keys(filters).length > 0;

  const row = (v: View) => {
    const active = sameFilters(v.filters, filters);
    const canDelete = v.ownedByMe || (v.shared && isAdmin);
    // Open and delete are sibling menu items, not a button inside an item, so
    // both stay reachable by keyboard and screen readers.
    return (
      <div key={v.id} className="flex items-center">
        <DropdownMenuItem onSelect={() => router.push(v.href)} className="flex min-w-0 flex-1 items-center gap-2">
          {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-label="Current view" /> : <span className="w-3.5 shrink-0" />}
          <span className="truncate">{v.name}</span>
          {v.shared && v.ownerName && <span className="shrink-0 text-xs text-zinc-500">{v.ownerName}</span>}
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem
            aria-label={`Delete view ${v.name}`}
            className="shrink-0 text-zinc-500 hover:text-red-600"
            onSelect={() => {
              if (window.confirm(`Delete the view "${v.name}"?`)) remove.mutate(v.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </DropdownMenuItem>
        )}
      </div>
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-3.5 w-3.5" />
            Views
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[240px]">
          {isError && <div className="px-2 py-1.5 text-xs text-red-600">Could not load saved views.</div>}
          {mine.length > 0 && <DropdownMenuLabel>My views</DropdownMenuLabel>}
          {mine.map(row)}
          {sharedViews.length > 0 && (
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Shared with the organisation
            </DropdownMenuLabel>
          )}
          {sharedViews.map(row)}
          {views.length === 0 && !isError && (
            <div className="px-2 py-1.5 text-xs text-zinc-500">No saved views yet.</div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasFilters}
            onSelect={() => {
              setError(null);
              setSaving(true);
            }}
          >
            Save current filters as a view…
          </DropdownMenuItem>
          {!hasFilters && (
            <div className="px-2 pb-1.5 text-xs text-zinc-500">Choose a filter first, then save it.</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Saves the filters you have set now. Opening the view shows current figures.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="saved-view-name">Name</Label>
              <Input
                id="saved-view-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {canShare && (
              <div className="flex items-center gap-2">
                <Checkbox id="saved-view-shared" checked={shared} onCheckedChange={setShared} />
                <Label htmlFor="saved-view-shared">Share with the organisation</Label>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaving(false)}>Cancel</Button>
              <Button type="submit" disabled={!name.trim() || save.isPending}>
                {save.isPending ? "Saving…" : "Save view"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
