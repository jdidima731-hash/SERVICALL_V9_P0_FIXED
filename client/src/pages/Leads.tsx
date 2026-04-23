import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Zap, 
  Plus, 
  Download,
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

interface LeadFormData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  budget?: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "new", title: "Nouveau", color: "bg-blue-500" },
  { id: "qualified", title: "Qualifié", color: "bg-green-500" },
  { id: "contacted", title: "Contacté", color: "bg-yellow-500" },
  { id: "proposal", title: "Proposition", color: "bg-purple-500" },
  { id: "negotiation", title: "Négociation", color: "bg-indigo-500" },
  { id: "converted", title: "Converti", color: "bg-emerald-500" },
  { id: "lost", title: "Perdu", color: "bg-red-500" },
];

export default function Leads() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>({});
  
  const { tenantId } = useTenant();

  // Mock data
  const [leads] = useState<any[]>([
    {
      id: 1,
      firstName: "Paul",
      lastName: "Bernard",
      email: "paul@startup.fr",
      phone: "+33612345678",
      company: "StartupXYZ",
      status: "new",
      source: "LinkedIn",
      budget: "50000",
    },
    {
      id: 2,
      firstName: "Sophie",
      lastName: "Leclerc",
      email: "sophie@pme.fr",
      phone: "+33687654321",
      company: "PME Solutions",
      status: "qualified",
      source: "Inbound",
      budget: "100000",
    },
  ]);

  // Transformer les leads en items Kanban
  const kanbanItems: KanbanItem[] = leads.map((lead) => ({
    id: lead.id,
    title: `${lead.firstName} ${lead.lastName}`,
    subtitle: lead.email,
    company: lead.company,
    status: lead.status || "new",
    metadata: lead,
  }));

  const handleStatusChange = (_itemId: number | string, _newStatus: string) => {
    toast.success("Lead mis à jour");
  };

  const handleCreateLead = () => {
    if (!formData.firstName && !formData.lastName && !formData.email) {
      toast.error("Veuillez remplir au moins un champ");
      return;
    }
    setIsCreateDialogOpen(false);
    setFormData({});
    toast.success("Lead créé avec succès");
  };

  const handleDeleteLead = (_itemId: number | string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce lead ?")) {
      toast.success("Lead supprimé");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-main-content>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Leads</h1>
          </div>
          <p className="text-muted-foreground">
            Gérez votre pipeline de leads générés et suivez leur qualification.
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="font-semibold">{leads.length} leads</span>
            <span>•</span>
            <span>{leads.filter(l => l.status === "new").length} nouveaux</span>
            <span>•</span>
            <span>{leads.filter(l => l.status === "qualified").length} qualifiés</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v as "kanban" | "list")} className="w-auto">
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

          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nouveau Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer un nouveau lead</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau lead à votre pipeline
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName || ""}
                      onChange={(e: any) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Paul"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName || ""}
                      onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Bernard"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="paul@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div>
                  <Label htmlFor="company">Entreprise</Label>
                  <Input
                    id="company"
                    value={formData.company || ""}
                    onChange={(e: any) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Startup XYZ"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={formData.source || ""}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="referral">Recommandation</SelectItem>
                        <SelectItem value="event">Événement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="budget">Budget</Label>
                    <Input
                      id="budget"
                      type="number"
                      value={formData.budget || ""}
                      onChange={(e: any) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="50000"
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
                    onClick={handleCreateLead}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer le lead
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
          onDelete={handleDeleteLead}
          showFilters={true}
          showSearch={true}
          emptyMessage="Aucun lead dans cette colonne"
          className="animate-slide-in-up"
        />
      )}

      {/* Liste View */}
      {viewMode === "list" && (
        <div className="text-center py-12 text-muted-foreground">
          Vue liste - À implémenter
        </div>
      )}
    </div>
  );
}
