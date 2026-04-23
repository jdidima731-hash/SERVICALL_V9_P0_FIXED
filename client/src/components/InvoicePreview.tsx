import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { useTenant } from "@/contexts/TenantContext";

interface InvoicePreviewProps {
  invoiceId: number;
}

export function InvoicePreview({ invoiceId }: InvoicePreviewProps) {
  const { tenantId: _tenantId } = useTenant();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data: invoice, isLoading, error } = trpc.billingLegal.invoice.get.useQuery({ invoiceId: parseInt(invoiceId.toString()) });
  const sendByEmail = trpc.billingLegal.invoice.sendByEmail.useMutation();
  const sendByWhatsApp = trpc.billingLegal.invoice.sendByWhatsApp.useMutation();

  const handleSendByEmail = async () => {
    if (!email) {
      alert("Veuillez entrer une adresse email");
      return;
    }

    try {
      await sendByEmail.mutateAsync({ invoiceId: parseInt(invoiceId.toString()), email });
      alert("Facture envoyée par email avec succès!");
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSendByWhatsApp = async () => {
    if (!phone) {
      alert("Veuillez entrer un numéro de téléphone");
      return;
    }

    try {
      await sendByWhatsApp.mutateAsync({ invoiceId: parseInt(invoiceId.toString()), phone });
      alert("Facture envoyée par WhatsApp avec succès!");
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-6">
          <div className="text-center">Chargement de la facture...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !invoice) {
    return (
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>
              Erreur lors du chargement de la facture: {error?.message || "Facture introuvable"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      accepted: "default",
      paid: "default",
    };

    return <Badge variant={variants[status] || "outline"}>{status.toUpperCase()}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      paid: "default",
      failed: "destructive",
    };

    return <Badge variant={variants[status] || "outline"}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Aperçu de la facture */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Facture {invoice.invoiceNumber}</CardTitle>
              <CardDescription>
                
                Créée le {invoice.createdAt ? new Date(invoice.createdAt as unknown as string).toLocaleDateString("fr-FR") : 'N/A'}
              </CardDescription>
            </div>
            <div className="space-x-2">
              {getStatusBadge(invoice.status || "draft")}
              {getPaymentStatusBadge(invoice.paymentStatus || "pending")}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Montants */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Montant HT</div>
                <div className="text-xl font-semibold">{Number(invoice.amount || 0).toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">TVA</div>
                <div className="text-xl font-semibold">{Number(invoice.tax || 0).toFixed(2)} €</div>
              </div>
              <div className="col-span-2 border-t pt-2">
                <div className="text-sm text-gray-600">Montant TTC</div>
                <div className="text-2xl font-bold text-blue-600">
                  {(Number(invoice.amount || 0) + Number(invoice.tax || 0)).toFixed(2)} €
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Description</div>
              <div className="text-gray-800">{invoice.description}</div>
            </div>
          )}

          {/* Template */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Template</div>
            <div className="text-gray-800">{invoice.template || "default"}</div>
          </div>

          {/* Lien sécurisé */}
          {invoice.secureLink && (
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Lien sécurisé</div>
              <div className="flex items-center space-x-2">
                <Input
                  value={invoice.secureLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(invoice.secureLink!);
                    alert("Lien copié!");
                  }}
                >
                  Copier
                </Button>
              </div>
              {invoice.linkExpiresAt && (
                <div className="text-xs text-gray-500 mt-1">
                  Expire le {new Date(invoice.linkExpiresAt).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          )}

          {/* Informations d'acceptation */}
          {invoice.acceptedAt && (
            <Alert>
              <AlertDescription>
                <div className="font-medium">Facture acceptée</div>
                <div className="text-sm">
                  Le {new Date(invoice.acceptedAt).toLocaleString("fr-FR")}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Informations de paiement */}
          {invoice.paidAt && (
            <Alert>
              <AlertDescription>
                <div className="font-medium">Paiement reçu</div>
                <div className="text-sm">
                  Le {new Date(invoice.paidAt).toLocaleString("fr-FR")}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions d'envoi */}
      {invoice.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Envoyer la facture</CardTitle>
            <CardDescription>
              Envoyez la facture au client par email ou WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Envoi par email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email du client</Label>
              <div className="flex space-x-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="flex-1"
                />
                <Button
                  onClick={handleSendByEmail}
                  disabled={sendByEmail.isPending}
                >
                  {sendByEmail.isPending ? "Envoi..." : "Envoyer"}
                </Button>
              </div>
            </div>

            {/* Envoi par WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone du client</Label>
              <div className="flex space-x-2">
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e: any) => setPhone(e.target.value)}
                  placeholder="+33612345678"
                  className="flex-1"
                />
                <Button
                  onClick={handleSendByWhatsApp}
                  disabled={sendByWhatsApp.isPending}
                  variant="outline"
                >
                  {sendByWhatsApp.isPending ? "Envoi..." : "WhatsApp"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}