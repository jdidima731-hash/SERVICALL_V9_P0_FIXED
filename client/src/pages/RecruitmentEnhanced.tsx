/**
 * Page Recrutement Améliorée - Module IA Complet
 * Gestion des CVs, offres d'emploi, matching IA, RDV et pipeline candidats
 */
import { useState } from "react";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// ✅ FIX TS6133: DialogDescription non utilisé - retiré de l'import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// ✅ FIX TS6133: Users non utilisé - retiré de l'import
import { Upload, Brain, Calendar, TrendingUp, Send, MessageSquare, Plus, FileText, Zap  } from 'lucide-react';
// ✅ FIX TS6133: useTranslation/t non utilisés - retirés

export default function RecruitmentEnhanced() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedJobOffer, setSelectedJobOffer] = useState<number | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [selectedRequirement, setSelectedRequirement] = useState<number | null>(null);

  // ============================================
  // QUERIES
  // ============================================

  const { data: jobOffers, isLoading: jobOffersLoading } = trpc.aiAutomation.recruitmentEnhanced.getJobOffers.useQuery({});

  const { data: stats } = trpc.aiAutomation.recruitmentEnhanced.getRecruitmentStats.useQuery({});

  const { data: availableSlots } = trpc.aiAutomation.recruitmentEnhanced.getAvailableSlots.useQuery({
    fromDate: new Date().toISOString(),
    toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // ============================================
  // MUTATIONS
  // ============================================

  const createJobOfferMutation = trpc.aiAutomation.recruitmentEnhanced.createJobOffer.useMutation({
    onSuccess: () => {
      toast.success("Offre d'emploi créée");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const parseCVMutation = trpc.aiAutomation.recruitmentEnhanced.parseCV.useMutation({
    onSuccess: () => {
      toast.success("CV analysé avec succès");
      setCvFile(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'analyse du CV");
    },
  });

  const createRequirementMutation = trpc.aiAutomation.recruitmentEnhanced.createJobRequirement.useMutation({
    onSuccess: (result: any) => {
      toast.success("Exigence créée");
      setSelectedRequirement(result.data.id);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const chatWithAIMutation = trpc.aiAutomation.recruitmentEnhanced.chatWithAI.useMutation({
    onSuccess: () => {
      toast.success("Message envoyé");
      setChatMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors du chat");
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleCVUpload = async () => {
    if (!cvFile || !selectedJobOffer) {
      toast.error("Sélectionnez un fichier et une offre d'emploi");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = (e.target?.result as string).split(",")[1];
      await parseCVMutation.mutateAsync({
        // ✅ FIX: candidateId dynamique basé sur l'offre sélectionnée (0 = création d'un nouvel entretien)
        candidateId: selectedJobOffer ?? 0,
        cvBase64: base64,
        fileName: cvFile.name,
        jobOfferId: selectedJobOffer,
      });
    };
    reader.readAsDataURL(cvFile);
  };

  const handleCreateJobOffer = async (formData: any) => {
    await createJobOfferMutation.mutateAsync(formData);
  };

  const handleCreateRequirement = async (formData: any) => {
    await createRequirementMutation.mutateAsync({
      jobOfferId: selectedJobOffer,
      ...formData,
    });
  };

  const handleChatWithAI = async () => {
    if (!selectedRequirement || !chatMessage) {
      toast.error("Sélectionnez une exigence et entrez un message");
      return;
    }

    await chatWithAIMutation.mutateAsync({
      requirementId: selectedRequirement,
      message: chatMessage,
    });
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 p-6" data-main-content>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Module de Recrutement IA</h1>
          <p className="text-gray-600 mt-1">Gestion complète des candidats avec matching IA</p>
        </div>
        <Badge className="bg-blue-100 text-blue-800 px-4 py-2">
          <Zap className="w-4 h-4 mr-2" />
          IA Engine Actif
        </Badge>
      </div>

      {/* KPIs Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Candidats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{String(((stats as Record<string,unknown>)?.data as Record<string,unknown> | null)?.total ?? 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Tous les entretiens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Envoyés au Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{String(((stats as Record<string,unknown>)?.data as Record<string,unknown> | null)?.sentToClient ?? 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Prêts pour validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Acceptés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{String(((stats as Record<string,unknown>)?.data as Record<string,unknown> | null)?.accepted ?? 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Par le client</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Score IA Moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {((((stats as Record<string,unknown>)?.data as Record<string,unknown> | null)?.averageMatchingScore as number | undefined)?.toFixed(1)) ?? "0"}%
            </div>
            <Progress value={(((stats as Record<string,unknown>)?.data as Record<string,unknown> | null)?.averageMatchingScore as number | undefined) ?? 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Offres
          </TabsTrigger>
          <TabsTrigger value="cv" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            CVs
          </TabsTrigger>
          <TabsTrigger value="ai-engine" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            IA Engine
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            RDV
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble du Pipeline</CardTitle>
              <CardDescription>État des candidats dans le processus de recrutement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Kanban-style pipeline */}
                <div className="grid grid-cols-5 gap-4">
                  {["Reçu", "Présélectionné", "Entretien", "Validé", "Envoyé Client"].map((stage) => (
                    <div key={stage} className="bg-gray-50 p-4 rounded-lg border">
                      <h3 className="font-semibold text-sm mb-3">{stage}</h3>
                      <div className="space-y-2">
                        <div className="bg-white p-3 rounded border border-gray-200 text-xs">
                          <p className="font-medium">Candidat 1</p>
                          <p className="text-gray-600">Score: 8.5/10</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offres d'Emploi</CardTitle>
              <CardDescription>Gérez vos offres et créez de nouvelles opportunités</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une Offre
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer une Offre d'Emploi</DialogTitle>
                  </DialogHeader>
                  <CreateJobOfferForm onSubmit={handleCreateJobOffer} />
                </DialogContent>
              </Dialog>

              {jobOffersLoading ? (
                <p className="text-gray-600">Chargement...</p>
              ) : (
                <div className="space-y-2">
                  {(jobOffers as Record<string, unknown>[] | undefined)?.map((offer: Record<string, unknown>) => (
                    <div key={offer.id as string} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{String(offer.title ?? "")}</h3>
                          <p className="text-sm text-gray-600">{String(offer.location ?? "")}</p>
                        </div>
                        <Badge variant={offer.priority === "high" ? "destructive" : "secondary"}>
                          {String(offer.priority ?? "")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CV Tab */}
        <TabsContent value="cv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des CVs</CardTitle>
              <CardDescription>Uploadez et analysez les CVs des candidats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Sélectionner une Offre</label>
                  <Select value={selectedJobOffer?.toString() || ""} onValueChange={(v: any) => setSelectedJobOffer(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une offre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(jobOffers as {data?: Record<string,unknown>[]})?.data?.map((offer) => (
                        <SelectItem key={offer.id as string} value={(offer.id as string).toString()}>
                          {offer.title as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Upload CV (PDF/DOC)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e: any) => setCvFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="cv-upload"
                    />
                    <label htmlFor="cv-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-medium">{cvFile?.name || "Cliquez pour sélectionner un fichier"}</p>
                    </label>
                  </div>
                </div>

                <Button onClick={handleCVUpload} disabled={!cvFile || !selectedJobOffer} className="w-full">
                  Analyser le CV avec l'IA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Engine Tab */}
        <TabsContent value="ai-engine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moteur IA - Définir les Exigences</CardTitle>
              <CardDescription>Décrivez vos exigences en langage naturel, l'IA génère le profil idéal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Brain className="w-4 h-4 mr-2" />
                    Créer une Exigence Client
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Définir les Exigences Client</DialogTitle>
                  </DialogHeader>
                  <CreateRequirementForm onSubmit={handleCreateRequirement} />
                </DialogContent>
              </Dialog>

              {selectedRequirement && (
                <div className="space-y-4 mt-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Chat IA
                    </h3>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Posez une question pour affiner le profil idéal..."
                        value={chatMessage}
                        onChange={(e: any) => setChatMessage(e.target.value)}
                        rows={3}
                      />
                      <Button onClick={handleChatWithAI} className="w-full">
                        <Send className="w-4 h-4 mr-2" />
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendrier des RDV</CardTitle>
              <CardDescription>Gérez les créneaux d'entretien</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un Créneau
                </Button>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Créneaux Disponibles</h3>
                  {(availableSlots as {data?: Record<string,unknown>[]})?.data?.slice(0, 5).map((slot) => (
                    <div key={slot.id as string} className="p-3 border rounded-lg bg-gray-50">
                      <p className="font-medium text-sm">{new Date(slot.slotDate as string).toLocaleString()}</p>
                      <p className="text-xs text-gray-600">{slot.slotDuration as string} min - {slot.interviewType as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// FORM COMPONENTS
// ============================================

function CreateJobOfferForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    salaryRange: "",
    contractType: "CDI",
    priority: "medium",
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Titre du poste" value={formData.title} onChange={(e: any) => setFormData({ ...formData, title: e.target.value })} />
      <Textarea placeholder="Description du poste" value={formData.description} onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} />
      <Input placeholder="Localisation" value={formData.location} onChange={(e: any) => setFormData({ ...formData, location: e.target.value })} />
      <Input placeholder="Fourchette salariale" value={formData.salaryRange} onChange={(e: any) => setFormData({ ...formData, salaryRange: e.target.value })} />
      <Select value={formData.contractType} onValueChange={(v: any) => setFormData({ ...formData, contractType: v })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CDI">CDI</SelectItem>
          <SelectItem value="CDD">CDD</SelectItem>
          <SelectItem value="Freelance">Freelance</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleSubmit} className="w-full">
        Créer l'Offre
      </Button>
    </div>
  );
}

function CreateRequirementForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const [formData, setFormData] = useState({
    title: "",
    clientRequirementsRaw: "",
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Titre du poste" value={formData.title} onChange={(e: any) => setFormData({ ...formData, title: e.target.value })} />
      <Textarea
        placeholder="Décrivez vos exigences en détail (compétences, expérience, traits de personnalité, etc.)"
        value={formData.clientRequirementsRaw}
        onChange={(e: any) => setFormData({ ...formData, clientRequirementsRaw: e.target.value })}
        rows={5}
      />
      <Button onClick={handleSubmit} className="w-full">
        Générer le Profil IA
      </Button>
    </div>
  );
}
