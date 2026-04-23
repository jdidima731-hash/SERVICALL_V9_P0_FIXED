/**
 * DYNAMIC STEP FORM
 * Formulaire dynamique pour configurer les actions de workflow.
 * ✅ BLOC 7 : Config-driven, Validation frontend, Pas de redesign.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DynamicStepFormProps {
  type: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
}

function strVal(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function numVal(v: unknown, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return Number(v) || fallback;
  return fallback;
}

export function DynamicStepForm({ type, config, onChange }: DynamicStepFormProps) {
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  switch (type) {
    case "send_email":
      return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Destinataire (Email)</Label>
            <Input 
              placeholder="ex: client@exemple.com ou {{email}}" 
              value={strVal(config['to'])} 
              onChange={(e) => handleChange("to", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Sujet</Label>
            <Input 
              placeholder="Sujet de l'email" 
              value={strVal(config['subject'])} 
              onChange={(e) => handleChange("subject", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Message</Label>
            <Textarea 
              placeholder="Contenu de l'email. Utilisez {var} pour les variables." 
              value={strVal(config['body'])} 
              onChange={(e) => handleChange("body", e.target.value)}
            />
          </div>
        </div>
      );

    case "send_sms":
      return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Numéro (E.164)</Label>
            <Input 
              placeholder="ex: +33612345678 ou {{phone}}" 
              value={strVal(config['to'])} 
              onChange={(e) => handleChange("to", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Message SMS</Label>
            <Textarea 
              placeholder="Message court. Utilisez {var} pour les variables." 
              value={strVal(config['body'])} 
              onChange={(e) => handleChange("body", e.target.value)}
            />
          </div>
        </div>
      );

    case "drive":
      return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Chemin du fichier</Label>
            <Input 
              placeholder="ex: rapports/client_1.txt" 
              value={strVal(config['path'])} 
              onChange={(e) => handleChange("path", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Opération</Label>
            <Select 
              value={strVal(config['operation'], "write")} 
              onValueChange={(v) => handleChange("operation", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="write">Écrire / Créer</SelectItem>
                <SelectItem value="read">Lire</SelectItem>
                <SelectItem value="delete">Supprimer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config['operation'] === "write" && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Contenu</Label>
              <Textarea 
                placeholder="Contenu à écrire..." 
                value={strVal(config['content'])} 
                onChange={(e) => handleChange("content", e.target.value)}
              />
            </div>
          )}
        </div>
      );

    case "create_order":
      return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Référence Commande</Label>
            <Input 
              placeholder="ex: CMD-{{prospect.id}}" 
              value={strVal(config['reference'])} 
              onChange={(e) => handleChange("reference", e.target.value)}
            />
          </div>
          
          <div className="space-y-2 border-t pt-2">
            <Label className="text-xs font-bold uppercase text-blue-600">Produit / Service</Label>
            <Input 
              placeholder="Nom du produit" 
              value={strVal(config['product_name'])} 
              onChange={(e) => handleChange("product_name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Quantité</Label>
              <Input 
                type="number"
                value={numVal(config['quantity'], 1)} 
                onChange={(e) => handleChange("quantity", parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Prix Unitaire</Label>
              <Input 
                type="number"
                placeholder="0.00" 
                value={strVal(config['unitPrice'])} 
                onChange={(e) => handleChange("unitPrice", parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Devise</Label>
              <Select 
                value={strVal(config['currency'], "EUR")} 
                onValueChange={(v) => handleChange("currency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 border-t pt-2">
            <Label className="text-xs font-bold uppercase">Notes & Instructions</Label>
            <Textarea 
              placeholder="Détails de la commande..." 
              value={strVal(config['notes'])} 
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </div>
          
          <div className="p-2 bg-blue-50 rounded text-[10px] text-blue-700">
            💡 Le montant total sera calculé automatiquement : {(numVal(config['quantity'], 1) * numVal(config['unitPrice'], 0)).toFixed(2)} {strVal(config['currency'], "EUR")} 
          </div>
        </div>
      );

    default:
      return (
        <div className="p-4 bg-slate-100 rounded-lg text-xs text-slate-500 italic">
          Configuration par défaut pour {type}. Édition brute non disponible.
        </div>
      );
  }
}
