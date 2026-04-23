import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail,
  Building2,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  PhoneCall,
 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Prospect {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  priority?: "low" | "medium" | "high";
}

interface ProspectKanbanProps {
  prospects: Prospect[];
  onStatusChange: (prospectId: number, newStatus: string) => void;
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospectId: number) => void;
  onCall?: (prospect: Prospect) => void;
  onEmail?: (prospect: Prospect) => void;
}

const COLUMNS = [
  { id: "new", title: "Nouveau", color: "bg-blue-500" },
  { id: "contacted", title: "Contacté", color: "bg-yellow-500" },
  { id: "qualified", title: "Qualifié", color: "bg-green-500" },
  { id: "converted", title: "Converti", color: "bg-purple-500" },
  { id: "lost", title: "Perdu", color: "bg-red-500" },
];

const PRIORITY_COLORS = {
  low: "border-l-4 border-l-gray-400",
  medium: "border-l-4 border-l-orange-400",
  high: "border-l-4 border-l-red-500",
};

function ProspectCard({
  prospect,
  onEdit,
  onDelete,
  onCall,
  onEmail,
  isDragging,
}: {
  prospect: Prospect;
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospectId: number) => void;
  onCall?: (prospect: Prospect) => void;
  onEmail?: (prospect: Prospect) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const fullName = [prospect.firstName, prospect.lastName]
    .filter(Boolean)
    .join(" ") || "Sans nom";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group bg-card rounded-xl border border-border p-4 mb-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        prospect.priority && PRIORITY_COLORS[prospect.priority],
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{fullName}</h4>
          {prospect.company && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{prospect.company}</span>
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e: any) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.location.href = `/prospects/${prospect.id}`}>
              <Eye className="w-4 h-4 mr-2" />
              Voir détails
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(prospect)}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(prospect.id)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {onCall && prospect.phone && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 flex-1 hover:scale-[0.98] active:scale-95 transition-transform"
            onClick={(e: any) => {
              e.stopPropagation();
              onCall(prospect);
            }}
          >
            <PhoneCall className="w-3 h-3 mr-1" />
            Appeler
          </Button>
        )}
        {onEmail && prospect.email && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 flex-1 hover:scale-[0.98] active:scale-95 transition-transform"
            onClick={(e: any) => {
              e.stopPropagation();
              onEmail(prospect);
            }}
          >
            <Mail className="w-3 h-3 mr-1" />
            Email
          </Button>
        )}
      </div>

      {prospect.priority && (
        <div className="mt-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              prospect.priority === "high" && "bg-red-500/10 text-red-500 border-red-500/20",
              prospect.priority === "medium" && "bg-orange-500/10 text-orange-500 border-orange-500/20",
              prospect.priority === "low" && "bg-gray-500/10 text-gray-500 border-gray-500/20"
            )}
          >
            {prospect.priority === "high" && "Priorité haute"}
            {prospect.priority === "medium" && "Priorité moyenne"}
            {prospect.priority === "low" && "Priorité basse"}
          </Badge>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  prospects,
  onEdit,
  onDelete,
  onCall,
  onEmail,
}: {
  column: { id: string; title: string; color: string };
  prospects: Prospect[];
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospectId: number) => void;
  onCall?: (prospect: Prospect) => void;
  onEmail?: (prospect: Prospect) => void;
}) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <Card className="h-full flex flex-col border-border">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", column.color)} />
              <CardTitle className="text-sm font-semibold">{column.title}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {prospects.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-3">
          <SortableContext
            items={prospects.map((p: any) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {prospects.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Aucun prospect
              </div>
            ) : (
              prospects.map((prospect) => (
                <ProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onCall={onCall}
                  onEmail={onEmail}
                />
              ))
            )}
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProspectKanban({
  prospects,
  onStatusChange,
  onEdit,
  onDelete,
  onCall,
  onEmail,
}: ProspectKanbanProps) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeProspect = prospects.find((p: any) => p.id === active.id);
    if (!activeProspect) {
      setActiveId(null);
      return;
    }

    // Trouver la colonne de destination
    const overProspect = prospects.find((p: any) => p.id === over.id);
    if (overProspect && overProspect.status !== activeProspect.status) {
      onStatusChange(activeProspect.id, overProspect.status);
    }

    setActiveId(null);
  };

  const activeProspect = activeId
    ? prospects.find((p: any) => p.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnProspects = prospects.filter(
            (p: any) => p.status === column.id
          );
          return (
            <KanbanColumn
              key={column.id}
              column={column}
              prospects={columnProspects}
              onEdit={onEdit}
              onDelete={onDelete}
              onCall={onCall}
              onEmail={onEmail}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeProspect && (
          <ProspectCard
            prospect={activeProspect}
            onEdit={onEdit}
            onDelete={onDelete}
            onCall={onCall}
            onEmail={onEmail}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
