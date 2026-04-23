
/**
 * Compliance Page - Dashboard de conformité et sécurité
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';
import { normalizeComplianceDashboard } from '@/utils/normalizers/security';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Lock,
  FileText,
  RefreshCw,
  Download,
  Eye,
  TrendingUp,
 } from 'lucide-react';
import type { ComplianceDashboard, ComplianceViolation, KeyHealth } from "../../../shared/types/security";
import { RouterOutputs } from "@/lib/trpc";


type GetComplianceDashboardOutput = RouterOutputs["security"]["getComplianceDashboard"];

export default function Compliance() {
  const { t } = useTranslation();
  const [dateRange, _setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);
  const [resolution, setResolution] = useState("");

  // Queries
  const { data: dashboardData, refetch: refetchDashboard } =
    trpc.core.security.getComplianceDashboard.useQuery(dateRange);
  const { data: keyHealthRaw } = trpc.core.security.checkKeyHealth.useQuery();
  const keyHealth = keyHealthRaw as any;

  // Mutations
  const runComplianceCheck = trpc.core.security.runPeriodicComplianceCheck.useMutation({
    onSuccess: () => {
      setTimeout(() => refetchDashboard(), 2000);
    },
  });

  const resolveViolationMutation = trpc.core.security.resolveViolation.useMutation({
    onSuccess: () => {
      setSelectedViolation(null);
      setResolution('');
      refetchDashboard();
    },
  });

  const generateReport = trpc.core.security.generateAuditReport.useMutation();

  const rotateKey = trpc.core.security.rotateKey.useMutation();

  // ✅ Bloc 3 & 4: Normalisation et Validation Runtime
  const dashboard: ComplianceDashboard | undefined = dashboardData?.dashboard ? normalizeComplianceDashboard(dashboardData.dashboard) : undefined;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleResolveViolation = () => {
    if (!selectedViolation || !resolution.trim()) return;

    resolveViolationMutation.mutate({
      violationId: selectedViolation.id,
      resolution,
    });
  };

  const handleGenerateReport = (format: 'json' | 'csv' | 'pdf') => {
    generateReport.mutate({
      ...dateRange,
      format,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-main-content>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('compliance.title')}</h1>
          <p className="text-muted-foreground">
            {t('compliance.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runComplianceCheck.mutate()}
            disabled={runComplianceCheck.isPending}
            variant="outline"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${runComplianceCheck.isPending ? 'animate-spin' : ''}`}
            />
            Vérifier
          </Button>
          <Button onClick={() => handleGenerateReport('json')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Rapport
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {dashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.compliance_rate')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.complianceRate}%
              </div>
              <Progress value={dashboard.complianceRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Taux de conformité global
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.violations')}</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {dashboard.violationsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Action immédiate requise
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.warnings')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {dashboard.warningsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                À surveiller
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.next_audit')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {new Date(dashboard.nextAuditDate).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Date du prochain audit
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="violations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t('compliance.violations')}
          </TabsTrigger>
          <TabsTrigger value="keys">
            <Key className="h-4 w-4 mr-2" />
            {t('compliance.keys')}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <TrendingUp className="h-4 w-4 mr-2" />
            {t('compliance.recommendations')}
          </TabsTrigger>
        </TabsList>

        {/* Violations Tab */}
        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle>Violations de Conformité</CardTitle>
              <CardDescription>
                Violations actives nécessitant une résolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard && dashboard.violations?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Sévérité</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Détecté</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.violations.map((violation: ComplianceViolation) => (
                      <TableRow key={violation.id}>
                        <TableCell>
                          <Badge>{violation.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(violation.severity)}>
                            {violation.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {violation.description}
                        </TableCell>
                        <TableCell>
                          {new Date(violation.detectedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedViolation(violation)}
                              >
                                Résoudre
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Résoudre la violation</DialogTitle>
                                <DialogDescription>
                                  Expliquez comment cette violation a été résolue.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Description de la résolution</label>
                                  <Textarea
                                    value={resolution}
                                    onChange={(e: any) => setResolution(e.target.value)}
                                    placeholder="Action corrective effectuée..."
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={handleResolveViolation}
                                  disabled={!resolution.trim() || resolveViolationMutation.isPending}
                                >
                                  {resolveViolationMutation.isPending ? 'En cours...' : 'Confirmer la résolution'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">Aucune violation détectée</h3>
                  <p className="text-muted-foreground">Votre système est conforme aux règles de sécurité.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des Clés KMS</CardTitle>
              <CardDescription>
                Santé et rotation des clés de chiffrement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(keyHealth as any) && (
                
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-slate-50">
                  <div className={`p-2 rounded-full ${(keyHealth as any).healthy ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    <Lock className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1">
                    
                    <h4 className="font-bold">État des clés : {(keyHealth as any).healthy ? 'Sain' : 'Alerte'}</h4>
                    <p className="text-sm text-muted-foreground">Dernière vérification : {new Date((keyHealth as any).lastCheckAt).toLocaleString()}</p>
                  </div>
                  <Button
                    
                    variant="outline"
                    
                    onClick={() => rotateKey.mutate({ keyType: 'data' })}
                    disabled={rotateKey.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${rotateKey.isPending ? 'animate-spin' : ''}`} />
                    Rotation des clés
                  </Button>
                </div>
              )}


              {(keyHealth as any)?.warnings?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-yellow-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Avertissements
                  </h4>
                  
                  <ul className="text-sm space-y-1 pl-6 list-disc text-slate-600">
                    {(keyHealth as any).warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Recommandations de Sécurité</CardTitle>
              <CardDescription>
                Actions suggérées par l'IA pour renforcer votre posture de sécurité
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard && dashboard.recommendations?.length > 0 ? (
                <ul className="space-y-4">
                  {dashboard.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg h-fit">
                        <Eye className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{rec}</p>
                        <Button variant="link" className="p-0 h-auto text-xs text-indigo-600 mt-1">En savoir plus</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center py-10 text-muted-foreground">Aucune recommandation pour le moment.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}