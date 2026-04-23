import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Shield,
  Lock,
  Eye,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Page de gestion de la conformité RGPD
 * Permet de gérer les consentements, les droits des utilisateurs et les logs d'audit
 */
export default function ComplianceRGPD() {
  const { tenantId } = useTenant();

  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [showRightToForgetDialog, setShowRightToForgetDialog] = useState(false);
  const [userIdToDelete, setUserIdToDelete] = useState("");

  // Queries
  const { data: complianceDashboardRaw, isLoading: dashboardLoading } =
    trpc.core.security.getComplianceDashboard.useQuery({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    });

  const complianceDashboard = ((complianceDashboardRaw as Record<string,unknown>)?.dashboard || complianceDashboardRaw) as Record<string,unknown> | null;

  // Audit logs via security router (procédure getAuditLogs ajoutée)
  const auditLogsQuery = trpc.core.security.getAuditLogs.useQuery({ tenantId, limit: 100 });
  const { data: auditLogsData, isLoading: auditLogsLoading = false } = auditLogsQuery;
  const auditLogs = (auditLogsData as Record<string,unknown>)?.logs as unknown[] ?? [];

  // Mutations RGPD — utilise anonymizeProspect (droit à l'oubli via anonymisation)
  const rightToForgetMutation = trpc.billingLegal.rgpd.anonymizeProspect.useMutation();

  const handleRightToBeForgotten = async () => {
    if (!userIdToDelete) {
      toast.error("Veuillez entrer un ID utilisateur");
      return;
    }

    try {
      await rightToForgetMutation.mutateAsync({
        prospectId: parseInt(userIdToDelete),
      });
      toast.success("Demande de droit à l'oubli enregistrée");
      setShowRightToForgetDialog(false);
      setUserIdToDelete("");
    } catch (error: any) {
      toast.error("Erreur lors de la demande de droit à l'oubli");
    }
  };

  // const _handleExportData = async (userId: number) => {
  //   try {
  //     await exportDataMutation?.mutateAsync?.({
  //       userId,
  //       tenantId,
  //     });
  //     toast.success("Export de données en cours...");
  //   } catch (error: any) {
  //     toast.error("Erreur lors de l'export de données");
  //   }
  // };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "compliant":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            CONFORME
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            AVERTISSEMENT
          </Badge>
        );
      case "violation":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            VIOLATION
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-main-content>
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Conformité RGPD & Sécurité
        </h1>
        <p className="text-muted-foreground">
          Gérez la conformité RGPD, les consentements et les droits des
          utilisateurs.
        </p>
      </div>

      {/* Tableau de Bord de Conformité */}
      {complianceDashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                État Global
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
        {String(String(complianceDashboard.overallStatus || "N/A" as unknown as string))}
              </div>
        {String(String(getStatusBadge(complianceDashboard.overallStatus as unknown as string)))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Consentements Actifs
              </CardTitle>
              <Eye className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
        {String(String(complianceDashboard.activeConsents || 0 as unknown as string))}
              </div>
              <p className="text-xs text-muted-foreground">
                Utilisateurs avec consentement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Demandes en Attente
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
        {String(String(complianceDashboard.pendingRequests || 0 as unknown as string))}
              </div>
              <p className="text-xs text-muted-foreground">
                Droit à l'oubli, accès, etc.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Violations Détectées
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
        {String(String(complianceDashboard.violations || 0 as unknown as string))}
              </div>
              <p className="text-xs text-muted-foreground">
                Nécessitant une action
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets de Gestion */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
          <TabsTrigger value="consents">Consentements</TabsTrigger>
          <TabsTrigger value="requests">Demandes</TabsTrigger>
          <TabsTrigger value="audit">Logs d'Audit</TabsTrigger>
        </TabsList>

        {/* Tableau de Bord */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Résumé de Conformité</CardTitle>
              <CardDescription>
                État général de la conformité RGPD et des politiques de
                sécurité.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Chiffrement des données</span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">
                    Actif
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Logs d'audit</span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">
                    Enregistrés
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-green-600" />
                    <span className="font-medium">
                      Transparence des traitements
                    </span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">
                    Conforme
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-yellow-600" />
                    <span className="font-medium">Rétention des données</span>
                  </div>
                  <Badge className="bg-yellow-500/10 text-yellow-500">
                    À vérifier
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dernières Actions de Conformité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium text-sm">
                      Audit de conformité effectué
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Il y a 2 jours
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium text-sm">
                      Mise à jour de la politique de confidentialité
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Il y a 1 semaine
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">
                      Rotation des clés de chiffrement
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Il y a 1 mois
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consentements */}
        <TabsContent value="consents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des Consentements</CardTitle>
              <CardDescription>
                Visualisez et gérez les consentements des utilisateurs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Consentement Marketing</p>
                    <p className="text-sm text-muted-foreground">
                      Email, SMS, notifications
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">245</p>
                    <p className="text-xs text-muted-foreground">
                      utilisateurs
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Consentement Analytics</p>
                    <p className="text-sm text-muted-foreground">
                      Suivi du comportement
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">189</p>
                    <p className="text-xs text-muted-foreground">
                      utilisateurs
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Consentement Enregistrement</p>
                    <p className="text-sm text-muted-foreground">
                      Appels et conversations
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">312</p>
                    <p className="text-xs text-muted-foreground">
                      utilisateurs
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demandes */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demandes RGPD</CardTitle>
              <CardDescription>
                Gérez les demandes d'accès, de rectification et de suppression.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog
                open={showRightToForgetDialog}
                onOpenChange={setShowRightToForgetDialog}
              >
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Nouvelle Demande de Droit à l'Oubli
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Demande de Droit à l'Oubli</DialogTitle>
                    <DialogDescription>
                      Initiez une demande de suppression de données pour un
                      utilisateur.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="userId">ID Utilisateur</Label>
                      <Input
                        id="userId"
                        placeholder="Entrez l'ID utilisateur"
                        value={userIdToDelete}
                        onChange={(e: any) => setUserIdToDelete(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleRightToBeForgotten}
                      disabled={rightToForgetMutation?.isPending}
                      variant="destructive"
                      className="w-full"
                    >
                      {rightToForgetMutation?.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        "Confirmer la Demande"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Droit à l'oubli - Utilisateur #145</p>
                    <p className="text-sm text-muted-foreground">
                      Demandé il y a 3 jours
                    </p>
                  </div>
                  <Badge className="bg-yellow-500/10 text-yellow-500">
                    En cours
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Export de données - Utilisateur #267</p>
                    <p className="text-sm text-muted-foreground">
                      Demandé il y a 1 jour
                    </p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">
                    Complété
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Rectification - Utilisateur #089</p>
                    <p className="text-sm text-muted-foreground">
                      Demandé il y a 5 jours
                    </p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">
                    Complété
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs d'Audit */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs d'Audit RGPD</CardTitle>
              <CardDescription>
                Historique complet des actions sensibles sur les données
                personnelles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-3">
                  {auditLogs.slice(0, 20).map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg text-sm"
                    >
                      <div>
                        <p className="font-medium">{log.action as unknown as string}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.resource as unknown as string} - {log.actorType as unknown as string}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono">
                          {new Date(log.timestamp as unknown as string).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun log disponible
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Exporter les Logs
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}