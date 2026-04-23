import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone,
  Mail,
  Building2,
  Edit,
  // Trash2,
  PhoneCall,
  // FileText,
  // Plus,
  ArrowLeft,
  Info,
  Cpu
 } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GlossaryTerm } from "@/components/GlossaryTerm";

type ProspectStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export default function ProspectDetail360() {
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  // const [noteContent, setNoteContent] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    status: "new" as ProspectStatus,
  });

  const searchParams = new URLSearchParams(window.location.search);
  void parseInt(searchParams.get("tenantId") || "1"); // tenantId from URL params
  const prospectId = parseInt(searchParams.get("prospectId") || "0");

  // Queries
  const prospectQuery = trpc.business.prospect.getById.useQuery(
    { prospectId: prospectId },
    { enabled: prospectId > 0 }
  );
  
  const callsQuery = trpc.communication.calls.list.useQuery(
    {},
    { enabled: prospectId > 0 }
  );

  // Mutations
  const updateMutation = trpc.business.prospect.update.useMutation({
    onSuccess: (data: any) => {
      const prospectName = `${data.firstName} ${data.lastName}`.trim();
      toast.success("✅ Modifications enregistrées", {
        description: `Les informations de ${prospectName} ont été mises à jour`,
        duration: 4000,
      });
      setIsEditDialogOpen(false);
      prospectQuery.refetch();
    },
    onError: (error) => {
      toast.error("❌ Erreur lors de la modification", {
        description: error.message || "Impossible de mettre à jour le prospect",
        duration: 5000,
      });
    },
  });

  const deleteMutation = trpc.business.prospect.delete.useMutation({
    onSuccess: () => {
      toast.success("✅ Prospect supprimé", {
        description: "Le prospect a été retiré de votre pipeline",
        duration: 4000,
      });
      setLocation("/prospects");
    },
    onError: (error) => {
      toast.error("❌ Erreur lors de la suppression", {
        description: error.message || "Impossible de supprimer le prospect",
        duration: 5000,
      });
    },
  });

  const prospect = prospectQuery.data;
  
  const calls = ((callsQuery.data as Record<string,unknown>)?.["calls"] ?? (callsQuery.data as Record<string,unknown>)?.["data"] ?? callsQuery.data ?? []) as Array<Record<string, unknown>>;

  const handleEditClick = () => {
    if (prospect) {
      setFormData({
        firstName: prospect.firstName || "",
        lastName: prospect.lastName || "",
        email: prospect.email || "",
        phone: prospect.phone || "",
        company: prospect.company || "",
        notes: prospect.notes || "",
        status: (prospect.status as ProspectStatus) || "new",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      prospectId: prospectId,
      ...formData,
    });
  };

  const handleDelete = async () => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce prospect ?")) {
      await deleteMutation.mutateAsync({ prospectId: prospectId });
    }
  };

  const handleCallProspect = () => {
    if (prospect?.phone) {
      setLocation(`/softphone?phone=${prospect.phone}&prospectId=${prospectId}`);
    } else {
      toast.error("❌ Numéro manquant", {
        description: "Aucun numéro de téléphone n'est enregistré pour ce prospect",
        duration: 4000,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "converted":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "qualified":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "contacted":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "lost":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  // Mock activities for timeline
  const activities = [
    ...calls.map((call: any) => ({
      id: `call-${call.id as string}`,
      type: "call",
      title: `Appel ${call.direction === "inbound" ? "entrant" : "sortant"}`,
      description: `Durée: ${call.duration as string}s`,
      timestamp: new Date(call.createdAt as string),
      icon: PhoneCall,
      color: "text-blue-500",
    })),
  ].sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());

  const filteredActivities = activities.filter((activity) => {
    if (activityFilter === "all") return true;
    return activity.type === activityFilter;
  });

  if (prospectQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-96" data-main-content>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Prospect non trouvé</p>
        <Button onClick={() => setLocation("/prospects")} className="mt-4">
          Retour aux prospects
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-3 hover:scale-[0.98] active:scale-95 transition-transform"
          onClick={() => setLocation("/prospects")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux prospects
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight">Fiche Contact 360°</h1>
          <div className="flex gap-2">
            <Button
              onClick={handleCallProspect}
              className="hover:scale-[0.98] active:scale-95 transition-transform"
            >
              <PhoneCall className="w-4 h-4 mr-2" />
              Appeler
            </Button>
            <Button
              onClick={handleEditClick}
              variant="outline"
              className="hover:scale-[0.98] active:scale-95 transition-transform"
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </div>
        </div>
      </div>

      {/* Layout 25/50/25 */}
      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* LEFT PANEL - 25% - Identité & Profil */}
        <div className="col-span-3 overflow-y-auto">
          <Card className="border-border rounded-xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-semibold">Identité</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {getInitials(prospect.firstName, prospect.lastName)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold">
                  {prospect.firstName} {prospect.lastName}
                </h3>
                {prospect.company && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Building2 className="w-3 h-3" />
                    {prospect.company}
                  </div>
                )}
                <div className="flex flex-col items-center gap-2 mt-3">
                  <Badge
                    variant="outline"
                    className={cn(getStatusColor(prospect.status || "new"))}
                  >
                    {(prospect.status || "new").toUpperCase()}
                  </Badge>
                  
                  {/* TRANSPARENCE IA */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Score IA : 85/100</span>
                    <GlossaryTerm termKey="AI_SCORING">
                      <Info className="w-3 h-3 text-primary/40 cursor-help" />
                    </GlossaryTerm>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Téléphone</p>
                    <p className="text-sm font-medium">{prospect.phone || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium">{prospect.email || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                >
                  Supprimer le prospect
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE PANEL - 50% - Timeline */}
        <div className="col-span-6 flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col border-border rounded-xl overflow-hidden">
            <CardHeader className="border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Timeline d'activité</CardTitle>
              <div className="flex gap-2">
                <Select value={activityFilter} onValueChange={(v: string) => setActivityFilter(v)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Filtrer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout</SelectItem>
                    <SelectItem value="call">Appels</SelectItem>
                    <SelectItem value="email">Emails</SelectItem>
                    <SelectItem value="note">Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-6">
              <div className="relative pl-6 border-l-2 border-muted space-y-8">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity, _idx) => (
                    <div key={activity.id} className="relative">
                      <div className={cn(
                        "absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white",
                        activity.type === "call" ? "bg-blue-500" : "bg-primary"
                      )} />
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm">{activity.title}</h4>
                          <span className="text-[10px] text-muted-foreground">
                            {activity.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground italic">
                    Aucune activité enregistrée
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL - 25% - Notes & Tasks */}
        <div className="col-span-3 space-y-6 overflow-y-auto">
          <Card className="border-border rounded-xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-semibold">Notes internes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground italic mb-4">
                {prospect.notes || "Aucune note pour ce prospect"}
              </p>
              <Textarea 
                placeholder="Ajouter une note..." 
                className="mb-3 text-sm min-h-[100px]"
              />
              <Button size="sm" className="w-full">Ajouter la note</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le prospect</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations de contact de {prospect.firstName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Prénom</label>
                <Input 
                  value={formData.firstName} 
                  onChange={(e: any) => setFormData({...formData, firstName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Nom</label>
                <Input 
                  value={formData.lastName} 
                  onChange={(e: any) => setFormData({...formData, lastName: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Email</label>
              <Input 
                value={formData.email} 
                onChange={(e: any) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Téléphone</label>
              <Input 
                value={formData.phone} 
                onChange={(e: any) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Entreprise</label>
              <Input 
                value={formData.company} 
                onChange={(e: any) => setFormData({...formData, company: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Statut</label>
              <Select 
                value={formData.status} 
                onValueChange={(v: ProspectStatus) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Nouveau</SelectItem>
                  <SelectItem value="contacted">Contacté</SelectItem>
                  <SelectItem value="qualified">Qualifié</SelectItem>
                  <SelectItem value="converted">Converti</SelectItem>
                  <SelectItem value="lost">Perdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}