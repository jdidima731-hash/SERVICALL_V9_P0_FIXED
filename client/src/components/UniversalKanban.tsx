import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone,
  Mail,
  Building2,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  PhoneCall,
  Clock,
  MessageSquare
 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/lib/callStore";


type UniversalKanbanProps = {
  items: KanbanItem[];
  columns: KanbanColumn[];
  onStatusChange: (itemId: string | number, newStatus: string) => void;
  onAction?: (action: string, itemId: string | number) => void;
  onEdit?: (item: KanbanItem) => void;
  onDelete?: (itemId: number | string) => void;
  onCall?: (item: KanbanItem) => void;
  onSms?: (item: KanbanItem) => void;
  onEmail?: (item: KanbanItem) => void;
  onView?: (item: KanbanItem) => void;
  emptyMessage?: string;
  className?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  onUpdate?: (item: Record<string, unknown>, newStatus: string) => void;
  renderCard?: (item: unknown) => React.ReactNode;
};

export interface KanbanItem {
  id: number | string;
  title: string;
  subtitle?: string;
  company?: string;
  status: string;
  priority?: "low" | "medium" | "high";
  phone?: string;
  email?: string;
  assignedTo?: string;
  dueDate?: Date | string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  icon?: React.ReactNode;
}

const PRIORITY_COLORS = {
  low: "border-l-slate-300",
  medium: "border-l-amber-400",
  high: "border-l-rose-500",
};

const PRIORITY_BADGE_COLORS = {
  low: "bg-slate-50 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

const PRIORITY_LABELS = {
  low: "Basse",
  medium: "Prioritaire",
  high: "Urgent",
};

function KanbanCard({
  item,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onEmail: _onEmail,
  onView,
  isDragging,
}: {
  item: KanbanItem;
  onEdit?: (item: KanbanItem) => void;
  onDelete?: (itemId: number | string) => void;
  onCall?: (item: KanbanItem) => void;
  onSms?: (item: KanbanItem) => void;
  onEmail?: (item: KanbanItem) => void;
  onView?: (item: KanbanItem) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const initiateCall = useCallStore((state) => state.initiateCall);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group bg-white rounded-xl border border-muted/60 p-4 mb-3 shadow-sm",
        "cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
        "active:scale-[0.98] transition-all duration-200",
        item.priority && `border-l-4 ${PRIORITY_COLORS[item.priority]}`,
        isDragging && "opacity-50 shadow-2xl scale-105 rotate-2"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-sm truncate text-foreground mb-0.5 tracking-tight">
            {item.title}
          </h4>
          {item.company && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <Building2 className="w-3 h-3 flex-shrink-0 opacity-60" />
              <span className="truncate">{item.company}</span>
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e: any) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-muted/60 p-1">
            {onView && (
              <DropdownMenuItem className="rounded-lg py-2.5 font-medium" onClick={() => onView(item)}>
                <Eye className="w-4 h-4 mr-2 opacity-60" />
                Voir le profil complet
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem className="rounded-lg py-2.5 font-medium" onClick={() => onEdit(item)}>
                <Edit className="w-4 h-4 mr-2 opacity-60" />
                Modifier les infos
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 rounded-lg py-2.5 font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer du pipeline
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Rows */}
      <div className="space-y-2 mb-4">
        {item.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground group/info">
            <Mail className="w-3 h-3 opacity-40 group-hover/info:opacity-100 transition-opacity" />
            <span className="truncate">{item.email}</span>
          </div>
        )}
        {item.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground group/info">
            <Phone className="w-3 h-3 opacity-40 group-hover/info:opacity-100 transition-opacity" />
            <span className="truncate font-medium">{item.phone}</span>
          </div>
        )}
      </div>

      {/* Footer / Meta */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-muted/40">
        <div className="flex items-center gap-2">
          {item.priority && (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0 h-5 border-none", PRIORITY_BADGE_COLORS[item.priority])}
            >
              {PRIORITY_LABELS[item.priority]}
            </Badge>
          )}
          {item.dueDate && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
              <Clock className="w-3 h-3 opacity-40" />
              <span>{formatDate(item.dueDate)}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-1">
          {onCall && item.phone && (
            <Button
              variant="secondary"
              size="icon"
              title={`Appeler ${item.title}`}
              className="h-8 w-8 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
              onClick={(e: any) => {
                e.stopPropagation();
                if (item.phone) {
                  initiateCall({
                    prospectId: typeof item.id === 'number' ? item.id : undefined,
                    prospectName: item.title,
                    phoneNumber: item.phone,
                  });
                }
                if (onCall) onCall(item);
              }}
            >
              <PhoneCall className="w-4 h-4" />
            </Button>
          )}
          {onSms && item.phone && (
            <Button
              variant="secondary"
              size="icon"
              title={`Envoyer un SMS à ${item.title}`}
              className="h-8 w-8 rounded-lg bg-green-500/5 text-green-600 hover:bg-green-500 hover:text-white transition-all shadow-sm"
              onClick={(e: any) => {
                e.stopPropagation();
                onSms(item);
              }}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumnComponent({
  column,
  items,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onEmail,
  onView,
  emptyMessage,
}: {
  column: KanbanColumn;
  items: KanbanItem[];
  onEdit?: (item: KanbanItem) => void;
  onDelete?: (itemId: number | string) => void;
  onCall?: (item: KanbanItem) => void;
  onSms?: (item: KanbanItem) => void;
  onEmail?: (item: KanbanItem) => void;
  onView?: (item: KanbanItem) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="flex-shrink-0 w-[300px] flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full shadow-sm", column.color)} />
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
            {column.title}
          </h3>
          <Badge variant="secondary" className="h-5 min-w-[20px] justify-center px-1 rounded-full bg-muted/50 text-[10px] font-bold">
            {items.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted">
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20">
        <SortableContext
          id={column.id}
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length > 0 ? (
            items.map((item: any) => (
              <KanbanCard
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
                onCall={onCall}
                onSms={onSms}
                onEmail={onEmail}
                onView={onView}
              />
            ))
          ) : (
            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-muted/40 rounded-2xl bg-muted/10 p-4 text-center">
              <div className="p-2 bg-muted/20 rounded-full mb-2">
                <Clock className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 leading-tight">
                {emptyMessage || "Vide"}
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function UniversalKanban({
  items,
  columns,
  onStatusChange,
  onAction: _onAction,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onEmail,
  onView,
  emptyMessage,
  className,
}: UniversalKanbanProps) {
  const [activeId, setActiveId] = useState<number | string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const itemsByStatus = useMemo(() => {
    const map: Record<string, KanbanItem[]> = {};
    columns.forEach((col) => {
      map[col.id] = items.filter((item: KanbanItem) => item.status === col.id);
    });
    return map;
  }, [items, columns]);

  const activeItem = useMemo(
    () => items.find((i: KanbanItem) => i.id === activeId),
    [items, activeId]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isOverAColumn = columns.some((col) => col.id === overId);
    if (isOverAColumn) {
      const activeItem = items.find((i: KanbanItem) => i.id === activeId);
      if (activeItem && activeItem.status !== overId) {
        onStatusChange(activeId, overId as string);
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      onStatusChange(activeId, overColumn.id);
      return;
    }

    const overItem = items.find((i: KanbanItem) => i.id === overId);
    if (overItem && overItem.status !== activeItem?.status) {
      onStatusChange(activeId, overItem.status);
    }
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20">
          {columns.map((column) => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              items={itemsByStatus[column.id] || []}
              onEdit={onEdit}
              onDelete={onDelete}
              onCall={onCall}
              onSms={onSms}
              onEmail={onEmail}
              onView={onView}
              emptyMessage={emptyMessage}
            />
          ))}
        </div>

        <DragOverlay adjustScale={true}>
          {activeId && activeItem ? (
            <div className="rotate-3 scale-105 shadow-2xl">
              <KanbanCard item={activeItem} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
