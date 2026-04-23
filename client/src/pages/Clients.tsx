import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Building2, 
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


import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UniversalKanban, KanbanItem, KanbanColumn } from "@/components/UniversalKanban";

interface ClientFormData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  notes?: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "prospect", title: "Prospect", color: "bg-blue-500" },
  { id: "active", title: "Client Actif", color: "bg-green-500" },
  { id: "inactive", title: "Inactif", color: "bg-gray-500" },
  { id: "vip", title: "VIP", color: "bg-purple-500" },
  { id: "churn", title: "À Risque", color: "bg-red-500" },
];

export default function Clients() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({});
  
  const { tenantId } = useTenant();

  // Mock data
  const [clients] = useState<any[]>([
    {
      id: 1,
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@acme.fr",
      phone: "+33612345678",
      company: "Acme Corp",
      status: "active",
      revenue: 50000,
    },
    {
      id: 2,
      firstName: "Marie",
      lastName: "Martin",
      email: "marie@techco.fr",
      phone: "+33687654321",
      company: "TechCo",
      status: "vip",
      revenue: 150000,
    },
  ]);

  // Transformer les clients en items Kanban
  const kanbanItems: KanbanItem[] = clients.map((client) => ({
    id: client.id,
    title: `${client.firstName} ${client.lastName}`,
    subtitle: client.email,
    company: client.company,
    status: client.status || "prospect",
    metadata: client,
  }));

  const handleStatusChange = (_itemId: number | string, _newStatus: string) => {
    toast.success("Client mis à jour");
  };

  const handleCreateClient = () => {
    if (!formData.firstName && !formData.lastName && !formData.email) {
      toast.error("Veuillez remplir au moins un champ");
      return;
    }
    setIsCreateDialogOpen(false);
    setFormData({});
    toast.success("Client créé avec succès");
  };

  const handleDeleteClient = (_itemId: number | string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      toast.success("Client supprimé");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-main-content>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Clients</h1>
          </div>
          <p className="text-muted-foreground">
            Gérez votre base clients et suivez les relations commerciales.
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="font-semibold">{clients.length} clients</span>
            <span>•</span>
            <span>{clients.filter(c => c.status === "active").length} actifs</span>
            <span>•</span>
            <span>{clients.filter(c => c.status === "vip").length} VIP</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v as typeof viewMode)} className="w-auto">
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
                Nouveau Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer un nouveau client</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau client à votre base
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
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName || ""}
                      onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Dupont"
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
                    placeholder="jean@example.com"
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
                    placeholder="Acme Inc"
                  />
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
                    onClick={handleCreateClient}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer le client
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
          onDelete={handleDeleteClient}
          showFilters={true}
          showSearch={true}
          emptyMessage="Aucun client dans cette catégorie"
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
