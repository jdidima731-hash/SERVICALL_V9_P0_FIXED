import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

interface InvoiceFormProps {
  prospectId?: number;
  callId?: number;
  onSuccess?: (invoiceId: number) => void;
}

export function InvoiceForm({ prospectId, callId, onSuccess }: InvoiceFormProps) {
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("20"); // TVA 20% par défaut
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("default");

  const createInvoice = trpc.billingLegal.invoice.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    const taxNum = parseFloat(tax);

    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Montant invalide");
      return;
    }

    if (isNaN(taxNum) || taxNum < 0) {
      alert("TVA invalide");
      return;
    }

    try {
      const result = await createInvoice.mutateAsync({
        prospectId: prospectId ? parseInt(prospectId.toString()) : undefined,
        callId: callId ? parseInt(callId.toString()) : undefined,
        amount: amountNum,
        taxRate: taxNum,
        description: description || "Facture sans description",
        template: template || undefined,
      });

      if (result.success && result.invoiceId) {
        alert(`Facture créée avec succès! ID: ${result.invoiceId}`);
        onSuccess?.(result.invoiceId);
        
        // Réinitialiser le formulaire
        setAmount("");
        setTax("20");
        setDescription("");
        setTemplate("default");
      }
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const totalAmount = () => {
    const amountNum = parseFloat(amount) || 0;
    const taxNum = parseFloat(tax) || 0;
    const taxAmount = (amountNum * taxNum) / 100;
    return (amountNum + taxAmount).toFixed(2);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Créer une facture</CardTitle>
        <CardDescription>
          Remplissez les informations de la facture client
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Montant HT */}
          <div className="space-y-2">
            <Label htmlFor="amount">Montant HT (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e: any) => setAmount(e.target.value)}
              placeholder="100.00"
              required
            />
          </div>

          {/* TVA */}
          <div className="space-y-2">
            <Label htmlFor="tax">TVA (%)</Label>
            <Input
              id="tax"
              type="number"
              step="0.01"
              min="0"
              value={tax}
              onChange={(e: any) => setTax(e.target.value)}
              placeholder="20"
              required
            />
          </div>

          {/* Montant TTC */}
          {amount && (
            <Alert>
              <AlertDescription>
                <strong>Montant TTC:</strong> {totalAmount()} €
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: any) => setDescription(e.target.value)}
              placeholder="Prestation de service..."
              rows={4}
            />
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <select
              id="template"
              value={template}
              onChange={(e: any) => setTemplate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="default">Par défaut</option>
              <option value="modern">Moderne</option>
              <option value="classic">Classique</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          {/* Informations contextuelles */}
          {(prospectId || callId) && (
            <Alert>
              <AlertDescription>
                {prospectId && <div>Prospect ID: {prospectId}</div>}
                {callId && <div>Appel ID: {callId}</div>}
              </AlertDescription>
            </Alert>
          )}

          {/* Bouton de soumission */}
          <Button
            type="submit"
            className="w-full"
            disabled={createInvoice.isPending}
          >
            {createInvoice.isPending ? "Création..." : "Créer la facture"}
          </Button>

          {/* Erreur */}
          {createInvoice.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {createInvoice.error.message}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
