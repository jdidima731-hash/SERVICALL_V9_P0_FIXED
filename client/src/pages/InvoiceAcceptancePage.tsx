import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Checkbox } from "../components/ui/checkbox";

export function InvoiceAcceptancePage() {
  const [, params] = useRoute("/invoice/accept/:token");
  const token = params ? params?.token as string : undefined;
  const [acceptedBy, setAcceptedBy] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  const { data: validation, isLoading, error } = trpc.billingLegal.invoice.validateToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  const acceptInvoice = trpc.billingLegal.invoice.acceptInvoice.useMutation();

  // Récupérer l'IP du client
  const [clientIP, setClientIP] = useState("");

  useEffect(() => {
    // Récupérer l'IP via un service externe
    fetch("https://api.ipify.org?format=json")
      .then((res: any) => res.json())
      .then((data: any) => setClientIP(data.ip))
      .catch(() => setClientIP("unknown"));
  }, []);

  const handleAccept = async () => {
    if (!acceptedBy.trim()) {
      alert("Veuillez entrer votre nom");
      return;
    }

    if (!acceptTerms) {
      alert("Veuillez accepter les conditions");
      return;
    }

    if (!token) {
      alert("Token invalide");
      return;
    }

    try {
      await acceptInvoice.mutateAsync({
        token,
        acceptedBy: acceptedBy.trim(),
        acceptedIP: clientIP,
        signatureData: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        },
      });

      setIsAccepted(true);
      alert("Facture acceptée avec succès!");
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="text-center">Vérification de la facture...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !validation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-medium">Lien invalide ou expiré</div>
                <div className="text-sm mt-2">
                  Ce lien d'acceptation de facture n'est plus valide. Veuillez contacter le service client.
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = (validation as Record<string,unknown>).invoice;

  
  if (isAccepted || invoice.status === "accepted" || invoice.status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            
            <CardTitle className={invoice.status === "paid" ? "text-blue-600" : "text-green-600"}>
              
              {invoice.status === "paid" ? "✓ Facture payée" : "✓ Facture acceptée"}
            </CardTitle>
            <CardDescription>
              
              {invoice.status === "paid" 
                ? "Cette facture a été réglée avec succès." 
                : "Cette facture a déjà été acceptée et est en cours de traitement."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            
            <Alert className={invoice.status === "paid" ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}>
              <AlertDescription>
                
                <div className="font-medium">Facture {invoice.invoiceNumber as string}</div>
                
                <div className="text-sm mt-1">Montant: {parseFloat(invoice.totalAmount as string).toFixed(2)} €</div>
                
                {invoice.acceptedAt && (
                  <div className="text-sm mt-1">
                    
                    Acceptée le {new Date(invoice.acceptedAt as string).toLocaleString("fr-FR")}
                  </div>
                )}
                
                {invoice.acceptedAt && (
                  
                  <div className="text-sm">Par: {invoice.acceptedBy as string}</div>
                )}
                
                {invoice.paidAt && (
                  <div className="text-sm mt-1 font-semibold">
                    
                    Payée le {new Date(invoice.paidAt as string).toLocaleString("fr-FR")}
                  </div>
                )}
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">Merci de votre confiance.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  
  if (invoice.status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-medium">Lien expiré</div>
                <div className="text-sm mt-2">
                  
                  Ce lien d'acceptation de facture a expiré le {new Date(invoice.linkExpiresAt as string).toLocaleString("fr-FR")}.
                  Veuillez contacter le service client pour obtenir un nouveau lien.
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Acceptation de facture</CardTitle>
          <CardDescription>
            Veuillez vérifier les informations et accepter la facture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informations de la facture */}
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div>
              <div className="text-sm text-gray-600">Numéro de facture</div>
              
              <div className="text-lg font-semibold">{invoice.invoiceNumber}</div>
            </div>

            
            {invoice.description && (
              <div>
                <div className="text-sm text-gray-600">Description</div>
                
                <div className="text-gray-800">{invoice.description}</div>
              </div>
            )}

            <div className="border-t pt-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Montant HT</div>
                  <div className="text-lg font-semibold">
                    
                    {parseFloat(invoice.amount as string).toFixed(2)} €
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">TVA</div>
                  <div className="text-lg font-semibold">
                    
                    {parseFloat(invoice.tax as string).toFixed(2)} €
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-sm text-gray-600">Montant total TTC</div>
              <div className="text-2xl font-bold text-blue-600">
                
                {parseFloat(invoice.totalAmount as string).toFixed(2)} €
              </div>
            </div>
          </div>

          {/* Formulaire d'acceptation */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acceptedBy">Votre nom complet *</Label>
              <Input
                id="acceptedBy"
                type="text"
                value={acceptedBy}
                onChange={(e: any) => setAcceptedBy(e.target.value)}
                placeholder="Jean Dupont"
                required
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed">
                J'accepte les conditions générales de vente et confirme avoir pris connaissance du
                montant de la facture. Cette acceptation vaut engagement de paiement.
              </Label>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <div className="font-medium mb-1">Informations d'acceptation</div>
                <div>Date: {new Date().toLocaleString("fr-FR")}</div>
                <div>IP: {clientIP || "Récupération..."}</div>
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleAccept}
              className="w-full"
              disabled={acceptInvoice.isPending || !acceptedBy.trim() || !acceptTerms}
            >
              {acceptInvoice.isPending ? "Acceptation en cours..." : "Accepter la facture"}
            </Button>

            {acceptInvoice.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {acceptInvoice.error.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Informations légales */}
          <div className="border-t pt-4 space-y-3">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-xs text-gray-700">
                <div className="font-semibold mb-2 text-blue-900">⚠️ Signature Électronique - Conformité eIDAS</div>
                <p className="mb-2">
                  <strong>L'acceptation de cette facture constitue une preuve d'accord commercial (eIDAS – signature simple) 
                  et ne remplace pas une signature électronique qualifiée.</strong>
                </p>
                <p>
                  Cette acceptation électronique est conforme au règlement européen eIDAS (Règlement UE n° 910/2014) 
                  et constitue une preuve d'engagement contractuel. Les données d'acceptation (date, heure, identité, 
                  adresse IP) sont enregistrées de manière sécurisée et conservées conformément aux obligations légales.
                </p>
              </AlertDescription>
            </Alert>
            
            <div className="text-xs text-gray-500">
              <p>
                En acceptant cette facture, vous reconnaissez avoir pris connaissance des conditions
                générales de vente et vous engagez à régler le montant indiqué dans les délais convenus.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InvoiceAcceptancePage;