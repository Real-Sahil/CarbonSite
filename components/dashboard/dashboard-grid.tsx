"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { toLayout, type PlacedWidget } from "@/lib/dashboard/widgets";

export type GridWidget = PlacedWidget & { node: ReactNode };
type Source = "personal" | "organisation" | "preset";

const SPAN = { half: "", full: "lg:col-span-2" } as const;

function Item({ w, editing, onWidth, onHide }: { w: GridWidget; editing: boolean; onWidth: () => void; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: !editing });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${SPAN[w.width]} min-w-0 ${isDragging ? "z-10 opacity-80" : ""} ${editing ? "rounded-[14px] outline outline-2 outline-dashed outline-amber-300/70" : ""}`}
    >
      {editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-t-[12px] bg-amber-50 px-3 py-2 text-xs text-[#374151]">
          <button
            type="button"
            className="cursor-grab rounded-md border border-amber-200 bg-white px-2 py-1 font-medium active:cursor-grabbing"
            aria-label={`Move ${w.title}. Press space to pick it up, the arrow keys to move it and space to drop it.`}
            {...attributes}
            {...listeners}
          >
            ⠿ Move
          </button>
          <span className="mr-auto font-medium text-[#111827]">{w.title}</span>
          <Button type="button" size="sm" variant="outline" aria-label={`${w.title}: make it ${w.width === "full" ? "half" : "full"} width`} onClick={onWidth}>
            {w.width === "full" ? "Make half width" : "Make full width"}
          </Button>
          <Button type="button" size="sm" variant="outline" aria-label={`Hide ${w.title}`} onClick={onHide}>
            Hide
          </Button>
        </div>
      ) : null}
      <div className="[&>*:first-child]:mt-0">{w.node}</div>
    </div>
  );
}

/**
 * The dashboard's widgets, arranged. Editing is by pointer (drag), by keyboard
 * (the Move button picks a widget up and arrow keys move it) and by plain
 * buttons for width and hiding, so every change has a keyboard path. A layout is
 * only ids, order and widths: the figures inside are the server's, read under
 * the viewer's own role.
 */
export function DashboardGrid({
  orgId,
  widgets,
  isAdmin,
  source,
}: {
  orgId: string;
  widgets: GridWidget[];
  isAdmin: boolean;
  source: Source;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<GridWidget[]>(widgets);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const visible = items.filter((i) => !i.hidden);
  const hidden = items.filter((i) => i.hidden);
  const shown = editing ? visible : widgets.filter((w) => !w.hidden);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    setItems(arrayMove(items, from, to));
  }
  const patch = (id: string, change: Partial<PlacedWidget>) => setItems(items.map((i) => (i.id === id ? { ...i, ...change } : i)));

  async function call(method: "PUT" | "DELETE", scope: "personal" | "organisation") {
    setMessage(null);
    const res = await fetch(`/api/orgs/${orgId}/dashboard-layout${method === "DELETE" ? `?scope=${scope}` : ""}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ scope, layout: toLayout(items) }) : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.message ?? "Could not save the layout.");
      return false;
    }
    return true;
  }
  const finish = async (method: "PUT" | "DELETE", scope: "personal" | "organisation", done: string) => {
    if (await call(method, scope)) {
      setEditing(false);
      setMessage(done);
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="mt-6" aria-busy={pending}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button type="button" size="sm" onClick={() => finish("PUT", "personal", "Layout saved.")}>Save my layout</Button>
            {isAdmin ? (
              <Button type="button" size="sm" variant="outline" onClick={() => finish("PUT", "organisation", "Saved as the organisation default.")}>
                Save as organisation default
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => finish("DELETE", "personal", "Back to the default layout.")}>
              Reset my layout
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setItems(widgets); setEditing(false); setMessage(null); }}>
              Cancel
            </Button>
            {hidden.length > 0 ? (
              <label className="ml-auto flex items-center gap-2 text-xs text-[#374151]">
                Add widget
                <select
                  className="h-8 rounded-[10px] border border-[#E5E7EB] bg-white px-2 text-xs"
                  value=""
                  onChange={(e) => e.target.value && patch(e.target.value, { hidden: false })}
                >
                  <option value="">Choose…</option>
                  {hidden.map((h) => (
                    <option key={h.id} value={h.id}>{h.title}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => { setItems(widgets); setEditing(true); setMessage(null); }}>
              Customise dashboard
            </Button>
            <span className="text-xs text-[#6B7280]">
              {source === "personal" ? "Your layout" : source === "organisation" ? "Your organisation's default layout" : "Default layout for your role"}
            </span>
          </>
        )}
        {message ? <span aria-live="polite" className="text-xs text-[#374151]">{message}</span> : null}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-6 lg:grid-cols-2">
            {shown.map((w) => (
              <Item key={w.id} w={w} editing={editing} onWidth={() => patch(w.id, { width: w.width === "full" ? "half" : "full" })} onHide={() => patch(w.id, { hidden: true })} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
