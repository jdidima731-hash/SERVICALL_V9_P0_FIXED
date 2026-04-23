
/**
 * BUSINESS ENTITIES MANAGER
 * Gestionnaire CRUD pour les entités métier (produits, services, biens)
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc, RouterOutputs, RouterInputs } from "@/lib/trpc";
import { Plus, Edit, Trash2, Package, Search  } from 'lucide-react';


type BusinessEntityOutput = RouterOutputs["businessEntities"]["list"]["data"][number];

const ENTITY_TYPES = [
  { value: "product", label: "Produit" },
  { value: "service", label: "Service" },
  { value: "property", label: "Bien immobilier" },
  { value: "room", label: "Chambre" },
  { value: "appointment", label: "Créneau RDV" },
  { value: "menu_item", label: "Item menu" },
  { value: "other", label: "Autre" },
];

interface EntityFormData {
  id?: number;
  type: string;
  title: string;
  description: string;
  price: string;
  vatRate: string;
  isActive: boolean;
}

export function BusinessEntitiesManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityFormData | null>(null);

  const [formData, setFormData] = useState<EntityFormData>({
    type: "product",
    title: "",
    description: "",
    price: "",
    vatRate: "20",
    isActive: true,
  });

  // Queries
  const { data: entitiesData, isLoading, refetch } = trpc.business.businessEntities.list.useQuery();

  // Mutations
  const createEntity = trpc.business.businessEntities.create.useMutation({
    onSuccess: () => {
      toast.success("Entité créée avec succès");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateEntity = trpc.business.businessEntities.update.useMutation({
    onSuccess: () => {
      toast.success("Entité mise à jour");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteEntity = trpc.business.businessEntities.delete.useMutation({
    onSuccess: () => {
      toast.success("Entité supprimée");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      type: "product",
      title: "",
      description: "",
      price: "",
      vatRate: "20",
      isActive: true,
    });
    setEditingEntity(null);
  };

  const handleOpenDialog = (entity?: BusinessEntityOutput) => {
    if (entity) {
      setEditingEntity(entity || null);
      setFormData({
          id: entity.id,
          type: entity.type,
          title: entity.title,
          description: entity.description || "",
          price: entity.price?.toString() || "",
          vatRate: entity.vatRate?.toString() || "20",
          isActive: entity.isActive,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    
    const createPayload: RouterInputs['businessEntities']['create'] = {
      
      type: formData.type as RouterInputs['businessEntities']['create']['type'],
      title: formData.title,
      description: formData.description || undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      vatRate: formData.vatRate ? parseFloat(formData.vatRate) : undefined,
      isActive: formData.isActive,
    };

    if (editingEntity && formData.id) {
      
      const updatePayload: RouterInputs['businessEntities']['update'] = {
        id: formData.id,
        ...createPayload,
      };
      updateEntity.mutate(updatePayload);
    } else {
      createEntity.mutate(createPayload);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette entité ?")) {
      deleteEntity.mutate({ id });
    }
  };

  // Filtrer les entités
  const entities = entitiesData?.data || [];
  const filteredEntities = entities.filter((entity: BusinessEntityOutput) => {
    const matchesSearch = !searchQuery || 
      entity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || !selectedType || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Gestion des Entités Métier
        </CardTitle>
        <CardDescription>
          Gérez vos produits, services, biens et autres entités métier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : filteredEntities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune entité trouvée. Commencez par en créer une.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>TVA</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntities.map((entity: BusinessEntityOutput) => (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {ENTITY_TYPES.find((t) => t.value === entity.type)?.label || entity.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{entity.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entity.description || "-"}
                    </TableCell>
                    <TableCell>
                      {entity.price ? `${entity.price} €` : "-"}
                    </TableCell>
                    <TableCell>
                      {entity.vatRate ? `${entity.vatRate}%` : "20%"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entity.isActive ? "default" : "secondary"}>
                        {entity.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(entity)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entity.id as number)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEntity ? "Modifier l'entité" : "Créer une entité"}
              </DialogTitle>
              <DialogDescription>
                Renseignez les informations de l'entité métier
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e: any) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Pizza Margherita, Chambre Deluxe..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description détaillée..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Prix (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e: any) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatRate">TVA (%)</Label>
                  <Input
                    id="vatRate"
                    type="number"
                    step="0.1"
                    value={formData.vatRate}
                    onChange={(e: any) => setFormData({ ...formData, vatRate: e.target.value })}
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e: any) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Entité active
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createEntity.isPending || updateEntity.isPending}
              >
                {editingEntity ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}