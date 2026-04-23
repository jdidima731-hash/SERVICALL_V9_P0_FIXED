import React, { useState, useEffect } from "react";
import { Target, 
  Plus, 
  Upload, 
  Play, 
  Pause, 
  Settings, 
  FileText,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Loader2
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/contexts/TenantContext";

/**
 * CAMPAIGNS PAGE — SERVICALL V8
 * ✅ Gestion des campagnes d'appels et marketing
 * ✅ FIX V8 : Typage strict et suppression du @ts-nocheck
 */

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats?: {
    total: number;
    completed: number;
    failed: number;
  };
}

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState("list");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const { tenantId } = useTenant();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "import") {
      setIsImportDialogOpen(true);
    }
  }, []);

  const utils = trpc.useUtils();
  const campaignsQuery = trpc.business.campaign.list.useQuery({}, {
    enabled: !!tenantId,
    refetchOnWindowFocus: true,
  });

  const startDialerMutation = trpc.business.campaign.startDialer.useMutation({
    onSuccess: (data: any) => {
      toast.success(`✅ Campagne démarrée — ${data?.queued || 0} appel(s) en file`);
      utils.business.campaign.list.invalidate();
    },
    onError: (err) => toast.error(`❌ Erreur: ${err.message}`),
  });

  const stopDialerMutation = trpc.business.campaign.stopDialer.useMutation({
    onSuccess: () => {
      toast.success("⏹️ Campagne suspendue");
      utils.business.campaign.list.invalidate();
    },
    onError: (err) => toast.error(`❌ Erreur: ${err.message}`),
  });

  const createCampaignMutation = trpc.business.campaign.create.useMutation({
    onSuccess: async () => {
      toast.success("Campagne créée avec succès");
      setIsCreateDialogOpen(false);
      await utils.business.campaign.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Échec de la création : ${error.message}`);
    }
  });

  const createProspectMutation = trpc.business.prospect.create.useMutation();

  const displayCampaigns = (campaignsQuery.data as any)?.data as Campaign[] || [];

  const handleCreateCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await createCampaignMutation.mutateAsync({
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        type: formData.get("type") as string,
        config: {},
      });
    } catch (error) {
      // Géré par onError
    }
  };

  const handleImportCSV = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const csvFile = formData.get("csvFile");
    const listName = String(formData.get("listName") || "Import CSV").trim();

    if (!(csvFile instanceof File)) {
      toast.error("Veuillez sélectionner un fichier CSV valide.");
      return;
    }

    setIsImportingCsv(true);

    try {
      const content = await csvFile.text();
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      if (lines.length < 2) throw new Error("Fichier CSV vide ou invalide.");

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
      
      const getIdx = (names: string[]) => headers.findIndex(h => names.includes(h));
      const fNameIdx = getIdx(["firstname", "prenom"]);
      const lNameIdx = getIdx(["lastname", "nom"]);
      const emailIdx = getIdx(["email", "mail"]);
      const phoneIdx = getIdx(["phone", "telephone"]);
      const compIdx = getIdx(["company", "societe"]);

      let count = 0;
      for (const line of lines.slice(1)) {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
        const payload = {
          firstName: fNameIdx >= 0 ? values[fNameIdx] : undefined,
          lastName: lNameIdx >= 0 ? values[lNameIdx] : undefined,
          email: emailIdx >= 0 ? values[emailIdx] : undefined,
          phone: phoneIdx >= 0 ? values[phoneIdx] : undefined,
          company: compIdx >= 0 ? values[compIdx] : undefined,
          source: listName,
        };

        if (payload.phone || payload.email) {
          await createProspectMutation.mutateAsync(payload as any);
          count++;
        }
      }

      toast.success(`${count} prospect(s) importé(s).`);
      setIsImportDialogOpen(false);
    } catch (error: any) {
      toast.error(`Erreur d'import : ${error.message}`);
    } finally {
      setIsImportingCsv(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Campagnes Commerciales</h1>
          </div>
          <p className="text-muted-foreground">Gérez vos campagnes d'appels, SMS et emails automatisées.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Importer CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleImportCSV}>
                <DialogHeader>
                  <DialogTitle>Importer des contacts</DialogTitle>
                  <DialogDescription>Ajoutez massivement des prospects via CSV.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="csvFile">Fichier CSV</Label>
                    <Input id="csvFile" name="csvFile" type="file" accept=".csv" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="listName">Nom de la liste</Label>
                    <Input id="listName" name="listName" placeholder="ex: Prospects 2024" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isImportingCsv}>{isImportingCsv ? "Importation..." : "Lancer"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20"><Plus className="w-4 h-4" /> Nouvelle Campagne</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateCampaign}>
                <DialogHeader>
                  <DialogTitle>Créer une campagne</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select name="type" defaultValue="ai_qualification">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_qualification">Qualification IA</SelectItem>
                        <SelectItem value="outbound_dialer">Dialer Sortant</SelectItem>
                        <SelectItem value="sms_marketing">SMS Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCampaignMutation.isPending}>Créer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">Toutes les campagnes</TabsTrigger>
          <TabsTrigger value="stats">Statistiques globales</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {campaignsQuery.isPending ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={40} /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayCampaigns.map((campaign) => (
                <Card key={campaign.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
                      <Settings className="w-4 h-4 text-muted-foreground cursor-pointer" />
                    </div>
                    <CardTitle className="text-xl mt-2">{campaign.name}</CardTitle>
                    <CardDescription>{campaign.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mt-4">
                      {campaign.status === 'active' ? (
                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => stopDialerMutation.mutate({ campaignId: campaign.id })}>
                          <Pause size={14} /> Pause
                        </Button>
                      ) : (
                        <Button size="sm" className="w-full gap-2" onClick={() => startDialerMutation.mutate({ campaignId: campaign.id })}>
                          <Play size={14} /> Démarrer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'secondary' }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variant === 'default' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {children}
    </span>
  );
}
