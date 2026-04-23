
import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { CheckCircle2, 
  Plus,
  LayoutGrid,
  List,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UniversalKanban, KanbanItem, KanbanColumn } from "@/components/UniversalKanban";

interface TaskFormData {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "À Faire", color: "bg-blue-500" },
  { id: "in_progress", title: "En Cours", color: "bg-yellow-500" },
  { id: "done", title: "Terminé", color: "bg-green-500" },
];

export default function Tasks() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>({});
  
  const { tenantId } = useTenant();

  // Mock data - À remplacer par vrai appel tRPC
  const [tasks, setTasks] = useState<any[]>([
    {
      id: 1,
      title: "Appeler Acme Corp",
      description: "Suivi du devis",
      status: "todo",
      priority: "high",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      assignedTo: "Vous",
    },
    {
      id: 2,
      title: "Envoyer email",
      description: "Proposition commerciale",
      status: "in_progress",
      priority: "medium",
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      assignedTo: "Vous",
    },
    {
      id: 3,
      title: "Réunion client",
      description: "Présentation produit",
      status: "done",
      priority: "high",
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      assignedTo: "Vous",
    },
  ]);

  // Transformer les tâches en items Kanban
  const kanbanItems: KanbanItem[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    subtitle: task.description,
    status: task.status,
    priority: task.priority || "medium",
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
    metadata: task,
  }));

  const handleStatusChange = (itemId: number | string, newStatus: string) => {
    setTasks(tasks.map((t: any) => 
      t.id === itemId ? { ...t, status: newStatus } : t
    ));
    toast.success("Tâche mise à jour");
  };

  const handleCreateTask = () => {
    if (!formData.title) {
      toast.error("Veuillez entrer un titre");
      return;
    }

    const newTask = {
      id: Math.max(...tasks.map((t: any) => t.id), 0) + 1,
      title: formData.title,
      description: formData.description || "",
      status: "todo",
      priority: formData.priority || "medium",
      dueDate: formData.dueDate || new Date().toISOString(),
      assignedTo: formData.assignedTo || "Vous",
    };

    setTasks([...tasks, newTask]);
    setIsCreateDialogOpen(false);
    setFormData({});
    toast.success("Tâche créée avec succès");
  };

  const handleDeleteTask = (itemId: number | string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      setTasks(tasks.filter((t: any) => t.id !== itemId));
      toast.success("Tâche supprimée");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-main-content>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Tâches</h1>
          </div>
          <p className="text-muted-foreground">
            Gérez vos tâches et suivez votre productivité en temps réel.
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="font-semibold">{tasks.length} tâches</span>
            <span>•</span>
            <span>{tasks.filter((t: any) => t.status === "todo").length} à faire</span>
            <span>•</span>
            <span>{tasks.filter((t: any) => t.status === "done").length} terminées</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-auto">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                Liste
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle Tâche
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle tâche</DialogTitle>
                <DialogDescription>
                  Ajoutez une nouvelle tâche à votre liste
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e: any) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Appeler le client"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description || ""}
                    onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Détails de la tâche..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priorité</Label>
                    <Select
                      value={formData.priority || "medium"}
                      
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Date d'échéance</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate || ""}
                      onChange={(e: any) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateTask}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer la tâche
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" && (
        <UniversalKanban
          items={kanbanItems}
          columns={KANBAN_COLUMNS}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteTask}
          showFilters={true}
          showSearch={true}
          emptyMessage="Aucune tâche dans cette colonne"
          className="animate-slide-in-up"
        />
      )}

      {}
      {viewMode === "list" && (
        <div className="text-center py-12 text-muted-foreground">
          Vue liste - À implémenter
        </div>
      )}
    </div>
  );
}