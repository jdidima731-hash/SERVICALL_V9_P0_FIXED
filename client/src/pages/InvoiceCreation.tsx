
/**
 * BLOC 5 - Invoice Creation Page
 * Logique métier de facturation : Calcul HT -> TVA -> TTC dynamique
 * ✅ FIX: Validation assouplie, logs de debug, imports corrigés
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, 
  Check, 
  DollarSign, 
  FileText, 
  Send, 
  Calculator, 
  User, 
  AlertCircle,
  Loader2,
  History
 } from 'lucide-react';
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { Alert, AlertDescription} from "@/components/ui/alert";
import { TenantGuard } from "@/components/TenantGuard";

interface InvoiceForm {
  prospectId?: number;
  prospectName: string;
  prospectEmail: string;
  amountHT: string;
  taxRate: string;
  description: string;
}

export default function InvoiceCreation() {
  const { tenantId } = useTenant();
  const effectiveTenantId = tenantId;
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState<InvoiceForm>({
    prospectName: "",
    prospectEmail: "",
    amountHT: "",
    taxRate: "20",
    description: "",
  });
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Debug logs
  useEffect(() => {
  }, [formData]);

  // Queries
  const prospectsQuery = trpc.business.prospect.list.useQuery(
    { limit: 100, page: 1 },
    { enabled: !!tenantId }
  );
  
  const prospects = prospectsQuery.data?.items || [];

  // Mutations
  const createInvoiceMutation = trpc.billingLegal.invoice.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Facture créée avec succès !");
      setCreatedInvoice(data.invoice);
      resetForm();
    },
    onError: (error) => {
      console.error("[InvoiceCreation] Error:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      prospectName: "",
      prospectEmail: "",
      amountHT: "",
      taxRate: "20",
      description: "",
    });
  };

  // Calculs dynamiques
  const calculations = useMemo(() => {
    const ht = parseFloat(formData.amountHT) || 0;
    const rate = parseFloat(formData.taxRate) || 0;
    const tva = (ht * rate) / 100;
    const ttc = ht + tva;

    return {
      ht: ht.toFixed(2),
      tva: tva.toFixed(2),
      ttc: ttc.toFixed(2),
      isValid: ht > 0
    };
  }, [formData]);

  const handleProspectSelect = (id: string) => {
    const prospect = prospects.find((p: any) => p.id === parseInt(id));
    if (prospect) {
      setFormData({
        ...formData,
        prospectId: prospect.id,
        prospectName: `${prospect.firstName} ${prospect.lastName}`,
        prospectEmail: prospect.email || "",
      });
    }
  };

  const handleCreateInvoice = async () => {
    
    if (!calculations.isValid) {
      console.warn("[InvoiceCreation] Validation failed: amountHT is 0 or invalid");
      toast.error("Veuillez saisir un montant HT valide (> 0)");
      return;
    }

    const description = formData.description.trim() ||
      (formData.prospectName ? `Facture pour ${formData.prospectName}` : `Facture du ${new Date().toLocaleDateString("fr-FR")}`);

    const payload = {
      prospectId: formData.prospectId,
      amount: parseFloat(formData.amountHT),
      taxRate: parseFloat(formData.taxRate),
      description,
      prospectName: formData.prospectName || undefined,
      prospectEmail: formData.prospectEmail || undefined,
    };

    
    try {
      await createInvoiceMutation.mutateAsync(payload);
    } catch (err: any) {
      console.error("[InvoiceCreation] Mutation exception:", err);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/accept-invoice/${createdInvoice?.id}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success("Lien copié dans le presse-papier");
  };

  return (
    <TenantGuard>
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">Générez des factures professionnelles en quelques clics.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/invoices/history")} className="gap-2">
          <History className="w-4 h-4" />
          Historique
        </Button>
      </div>

      {createdInvoice ? (
        <Card className="border-2 border-green-500 bg-green-50/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-full">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Facture créée avec succès</CardTitle>
                <CardDescription>
                  La facture #{createdInvoice.invoiceNumber || createdInvoice.id} est prête.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryItem label="Montant HT" value={`${parseFloat(createdInvoice.amount || "0").toFixed(2)} €`} />
              <SummaryItem label="TVA" value={`${parseFloat(createdInvoice.tax || "0").toFixed(2)} €`} />
              <SummaryItem label="Total TTC" value={`${parseFloat(createdInvoice.totalAmount || "0").toFixed(2)} €`} highlight />
            </div>

            <div className="p-4 bg-white rounded-xl border space-y-3">
              <Label>Lien de paiement sécurisé</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/accept-invoice/${createdInvoice.id}`}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCreatedInvoice(null)}>
              Nouvelle Facture
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  1. Sélection du Prospect (optionnel)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Choisir un prospect existant</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    onChange={(e: any) => handleProspectSelect(e.target.value)}
                    value={formData.prospectId || ""}
                  >
                    <option value="">-- Sélectionner un prospect --</option>
                    {prospects.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} {p.email ? `(${p.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom complet</Label>
                    <Input 
                      value={formData.prospectName}
                      onChange={(e: any) => setFormData({...formData, prospectName: e.target.value})}
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={formData.prospectEmail}
                      onChange={(e: any) => setFormData({...formData, prospectEmail: e.target.value})}
                      placeholder="jean@exemple.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" />
                  2. Détails de la Facture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant HT (€) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="number"
                        className="pl-9"
                        value={formData.amountHT}
                        onChange={(e: any) => setFormData({...formData, amountHT: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Taux TVA (%)</Label>
                    <Select 
                      value={formData.taxRate}
                      onValueChange={(val: string) => setFormData({...formData, taxRate: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (Exonéré)</SelectItem>
                        <SelectItem value="5.5">5.5% (Réduit)</SelectItem>
                        <SelectItem value="10">10% (Intermédiaire)</SelectItem>
                        <SelectItem value="20">20% (Normal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description / Objet</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e: any) => setFormData({...formData, description: e.target.value})}
                    placeholder="Ex: Prestation de service Janvier 2026..."
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-medium">{calculations.ht} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({formData.taxRate}%)</span>
                  <span className="font-medium">{calculations.tva} €</span>
                </div>
                <div className="pt-4 border-t flex justify-between items-end">
                  <span className="font-bold">Total TTC</span>
                  <span className="text-2xl font-black text-primary">{calculations.ttc} €</span>
                </div>

                {!calculations.isValid && (
                  <Alert className="bg-orange-50 border-orange-200 py-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <AlertDescription className="text-xs text-orange-700">
                      Veuillez saisir un montant HT valide.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  disabled={!calculations.isValid || createInvoiceMutation.isPending}
                  onClick={handleCreateInvoice}
                  type="button"
                >
                  {createInvoiceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Générer la Facture
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
    </TenantGuard>
  );
}

function SummaryItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border bg-white ${highlight ? 'border-primary ring-1 ring-primary/20' : ''}`}>
      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-black ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}