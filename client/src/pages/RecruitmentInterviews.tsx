
import { useState } from "react";

import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { normalizeInterviews } from "../utils/normalizers/recruitment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import { Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Filter,
  Plus,
  Eye
 } from 'lucide-react';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Interview, InterviewStats } from "../../../shared/types/recruitment";
import { RouterOutputs, RouterInputs } from "../lib/trpc";


type ListInterviewsOutput = RouterOutputs['aiAutomation']['recruitment']['listInterviews'];

type GetStatsOutput = RouterOutputs['aiAutomation']['recruitment']['getStats'];

type CreateInterviewInput = RouterInputs['aiAutomation']['recruitment']['createInterview'];

type StartInterviewInput = RouterInputs['aiAutomation']['recruitment']['startInterview'];

type GenerateReportInput = RouterInputs['aiAutomation']['recruitment']['generateReport'];

type UpdateEmployerDecisionInput = RouterInputs['aiAutomation']['recruitment']['updateEmployerDecision'];





interface CreateInterviewFormProps {
  onSuccess: () => void;
}

// Définir le composant CreateInterviewForm pour éviter les erreurs de type
const CreateInterviewForm: React.FC<CreateInterviewFormProps> = ({ onSuccess }) => {
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [businessType, setBusinessType] = useState("");

  const createInterviewMutation = trpc.aiAutomation.recruitment.createInterview.useMutation({
    onSuccess: () => {
      toast.success("Entretien créé avec succès");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de créer l'entretien");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInterviewMutation.mutate({
      candidateName,
      candidateEmail,
      candidatePhone,
      jobPosition: jobTitle,
      scheduledAt: interviewDate,
      businessType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="candidateName">Nom du candidat</Label>
        <Input id="candidateName" value={candidateName} onChange={(e: any) => setCandidateName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="candidateEmail">Email du candidat</Label>
        <Input id="candidateEmail" type="email" value={candidateEmail} onChange={(e: any) => setCandidateEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="candidatePhone">Téléphone du candidat</Label>
        <Input id="candidatePhone" value={candidatePhone} onChange={(e: any) => setCandidatePhone(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Titre du poste</Label>
        <Input id="jobTitle" value={jobTitle} onChange={(e: any) => setJobTitle(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interviewDate">Date de l'entretien</Label>
        <Input type="datetime-local" id="interviewDate" value={interviewDate} onChange={(e: any) => setInterviewDate(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="businessType">Type de métier</Label>
        <Select value={businessType} onValueChange={setBusinessType}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionnez un type de métier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="medical_secretary">Secrétaire médical</SelectItem>
            <SelectItem value="restaurant_server">Serveur restaurant</SelectItem>
            <SelectItem value="hotel_receptionist">Réceptionniste hôtel</SelectItem>
            <SelectItem value="sales_representative">Commercial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={createInterviewMutation.isPending}>Créer</Button>
    </form>
  );
};

export default function RecruitmentInterviews() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("all");
  const [currentPage, _setCurrentPage] = useState(1);
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Récupérer les entretiens avec filtres
  const { data: interviewsData, isLoading, refetch } = trpc.aiAutomation.recruitment.listInterviews.useQuery({
    page: currentPage,
    limit: 20,
    status: selectedStatus !== "all" ? selectedStatus as Interview['status'] : undefined,
    businessType: selectedBusinessType !== "all" ? selectedBusinessType : undefined,
  });

  // Récupérer les statistiques
  const { data: statsData } = trpc.aiAutomation.recruitment.getStats.useQuery({
    businessType: selectedBusinessType !== "all" ? selectedBusinessType : undefined,
  });

  // Mutation pour démarrer un entretien
  const startInterviewMutation = trpc.aiAutomation.recruitment.startInterview.useMutation({
    onSuccess: () => {
      toast.success("Entretien IA démarré avec succès");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de démarrer l'entretien");
    },
  });

  // Mutation pour générer un rapport
  const generateReportMutation = trpc.aiAutomation.recruitment.generateReport.useMutation({
    onSuccess: () => {
      toast.success("Rapport généré avec succès");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de générer le rapport");
    },
  });

  // Mutation pour mettre à jour la décision
  const _updateDecisionMutation = trpc.aiAutomation.recruitment.updateEmployerDecision.useMutation({
    onSuccess: () => {
      toast.success("Décision enregistrée");
      refetch();
      setSelectedInterview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible d'enregistrer la décision");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ComponentType<{ className?: string }> }> = {
      pending: { variant: "secondary", label: "En attente", icon: Clock },
      scheduled: { variant: "default", label: "Planifié", icon: Calendar },
      in_progress: { variant: "default", label: "En cours", icon: Phone },
      completed: { variant: "default", label: "Terminé", icon: CheckCircle },
      reviewed: { variant: "default", label: "Examiné", icon: Eye },
      shortlisted: { variant: "default", label: "Présélectionné", icon: TrendingUp },
      rejected: { variant: "destructive", label: "Rejeté", icon: XCircle },
      cancelled: { variant: "secondary", label: "Annulé", icon: XCircle },
    };

    const config = variants[status] || variants["pending"];
    const Icon = config!.icon;

    return (
      
      <Badge variant={config!.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config!.label}
      </Badge>
    );
  };

  const getRecommendationBadge = (recommendation: string) => {
    if (recommendation === "hire") {
      return <Badge variant="default" className="bg-green-600">Recommandé</Badge>;
    } else if (recommendation === "reject") {
      return <Badge variant="destructive">Non recommandé</Badge>;
    } else {
      return <Badge variant="secondary">À évaluer</Badge>;
    }
  };

  // ✅ Bloc 3 & 4: Normalisation et Validation Runtime
  const interviews: any[] = interviewsData?.data ? normalizeInterviews(interviewsData.data) : [];
  const stats: GetStatsOutput = statsData || { total: 0, pending: 0, scheduled: 0, in_progress: 0, completed: 0, reviewed: 0, shortlisted: 0, rejected: 0, cancelled: 0 };

  return (
    <div className="container mx-auto p-6 space-y-6" data-main-content>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entretiens de Recrutement IA</h1>
          <p className="text-muted-foreground">
            Gérez vos entretiens automatisés et consultez les analyses comportementales
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel entretien
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un entretien candidat</DialogTitle>
              <DialogDescription>
                Planifiez un nouvel entretien IA pour un candidat
              </DialogDescription>
            </DialogHeader>
            <CreateInterviewForm onSuccess={() => {
              setShowCreateDialog(false);
              refetch();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Planifiés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Terminés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Présélectionnés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.shortlisted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejetés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et Liste */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="reviewed">Examiné</SelectItem>
                  <SelectItem value="shortlisted">Présélectionné</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedBusinessType} onValueChange={setSelectedBusinessType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Métier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les métiers</SelectItem>
                  <SelectItem value="medical_secretary">Secrétaire médical</SelectItem>
                  <SelectItem value="restaurant_server">Serveur restaurant</SelectItem>
                  <SelectItem value="hotel_receptionist">Réceptionniste hôtel</SelectItem>
                  <SelectItem value="sales_representative">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Chargement des entretiens...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidat</TableHead>
                  <TableHead>Poste / Métier</TableHead>
                  <TableHead>Date prévue</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Score IA</TableHead>
                  <TableHead>Recommandation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun entretien trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  interviews.map((interview) => (
                    <TableRow key={interview.id}>
                      <TableCell>
                        <div className="font-medium">{interview.candidateName}</div>
                        <div className="text-xs text-muted-foreground">{interview.candidatePhone}</div>
                      </TableCell>
                      <TableCell>
                        <div>{interview.jobPosition}</div>
                        <div className="text-xs text-muted-foreground">{interview.businessType}</div>
                      </TableCell>
                      <TableCell>
                        {interview.scheduledAt ? format(new Date(interview.scheduledAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(interview.status)}</TableCell>
                      <TableCell>
                        {interview.notesJson?.globalScore ? (
                          <div className="flex items-center gap-2">
                            <Progress value={interview.notesJson.globalScore * 10} className="w-12 h-2" />
                            <span className="font-bold">{interview.notesJson.globalScore * 10}%</span>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {interview.aiRecommendation ? getRecommendationBadge(interview.aiRecommendation) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {interview.status === "scheduled" && (
                            <Button size="sm" variant="outline" onClick={() => startInterviewMutation.mutate({ interviewId: interview.id })}>
                              Lancer l'appel
                            </Button>
                          )}
                          {interview.status === "completed" && !interview.aiSummary && (
                            <Button size="sm" variant="outline" onClick={() => generateReportMutation.mutate({ interviewId: interview.id })}>
                              Générer rapport
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setSelectedInterview(interview)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Détails de l'entretien */}
      <Dialog open={!!selectedInterview} onOpenChange={(open) => !open && setSelectedInterview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInterview && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-2xl">{selectedInterview.candidateName}</DialogTitle>
                    <DialogDescription>
                      Entretien pour le poste de {selectedInterview.jobPosition} ({selectedInterview.businessType})
                    </DialogDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(selectedInterview.status)}
                    {selectedInterview.aiRecommendation && getRecommendationBadge(selectedInterview.aiRecommendation)}
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="summary" className="mt-4">
                <TabsList>
                  <TabsTrigger value="summary">Résumé</TabsTrigger>
                  <TabsTrigger value="transcript">Transcription</TabsTrigger>
                  <TabsTrigger value="analysis">Analyse IA</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Informations Candidat</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Email:</span> {selectedInterview.candidateEmail || "Non renseigné"}</p>
                        <p><span className="text-muted-foreground">Téléphone:</span> {selectedInterview.candidatePhone}</p>
                        <p><span className="text-muted-foreground">Date:</span> {selectedInterview.scheduledAt ? format(new Date(selectedInterview.scheduledAt), "PPP p", { locale: fr }) : "-"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Score Global IA</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary">{(selectedInterview.notesJson?.globalScore || 0) * 10}%</div>
                        <Progress value={(selectedInterview.notesJson?.globalScore || 0) * 10} className="mt-2" />
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Résumé de l'entretien</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">
                        {selectedInterview.aiSummary || "Le rapport n'a pas encore été généré ou l'entretien n'est pas terminé."}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transcript" className="pt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {selectedInterview.transcript ? (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm whitespace-pre-wrap">{selectedInterview.transcript}</p>
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">Aucune transcription disponible</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analysis" className="space-y-4 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2 text-center">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Cohérence</CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="text-xl font-bold">{(selectedInterview.notesJson?.behavioralAnalysis?.coherenceScore || 0) * 10}/100</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2 text-center">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Honnêteté</CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="text-xl font-bold">{(selectedInterview.notesJson?.behavioralAnalysis?.honestyScore || 0) * 10}/100</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2 text-center">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Communication</CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="text-xl font-bold">{(selectedInterview.notesJson?.behavioralAnalysis?.communicationScore || 0) * 10}/100</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Points forts
                      </h4>
                      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                        {selectedInterview.notesJson?.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>) || <li>N/A</li>}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-red-600">
                        <XCircle className="h-4 w-4" /> Signaux d'alerte
                      </h4>
                      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                        {selectedInterview.notesJson?.redFlags?.map((w: string, i: number) => <li key={i}>{w}</li>) || <li>N/A</li>}
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
