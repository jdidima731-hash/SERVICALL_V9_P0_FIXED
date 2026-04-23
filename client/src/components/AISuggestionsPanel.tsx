/**
 * BLOC 3 - AI Suggestions Panel
 * Affiche les actions suggérées par l'IA avec validation humaine obligatoire
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/contexts/TenantContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles,
  CheckCircle2,
  XCircle,
  Edit3,
  MessageSquare,
  Clock,
  AlertCircle,
  Lightbulb,
 } from 'lucide-react';
import { toast } from "sonner";

interface AISuggestion {
  id: number;
  type: string;
  title: string;
  description: string;
  suggestedAction: {
    content?: string;
  };
  aiReasoning: string;
  confidence: number;
}



export default function AISuggestionsPanel() {
  const { tenantId } = useTenant();
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  
  const { data: suggestions, refetch } = trpc.aiAutomation.aiSuggestions.getPending.useQuery(undefined, {
    enabled: !!tenantId
  });

  const approveMutation = trpc.aiAutomation.aiSuggestions.approve.useMutation();
  const rejectMutation = trpc.aiAutomation.aiSuggestions.reject.useMutation();
  const modifyMutation = trpc.aiAutomation.aiSuggestions.modify.useMutation();

  const handleApprove = async (suggestionId: number) => {
    try {
      const result = await approveMutation.mutateAsync({
        
        
        suggestionId,
      });

      if (result.success) {
        toast.success("✅ Action approuvée et exécutée");
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur : ${errMsg}`);
    }
  };

  const handleReject = async (suggestionId: number) => {
    try {
      const result = await rejectMutation.mutateAsync({
        
        
        suggestionId,
      });

      if (result.success) {
        toast.info("Suggestion rejetée");
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur : ${errMsg}`);
    }
  };

  const handleEdit = (suggestion: AISuggestion) => {
    setSelectedSuggestion(suggestion);
    setEditedContent(suggestion.suggestedAction.content || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSuggestion) return;

    try {
      const result = await modifyMutation.mutateAsync({
        
        
        suggestionId: selectedSuggestion.id,
        newContent: editedContent,
      });

      if (result.success) {
        toast.success("Suggestion modifiée");
        setIsEditDialogOpen(false);
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur : ${errMsg}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "missed_call_followup":
        return <MessageSquare className="w-5 h-5" />;
      case "inactive_prospect":
        return <Clock className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "missed_call_followup":
        return "Relance appel manqué";
      case "inactive_prospect":
        return "Prospect inactif";
      case "appointment_reminder":
        return "Rappel RDV";
      case "qualification_followup":
        return "Suivi qualification";
      default:
        return type;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          Confiance élevée ({confidence}%)
        </Badge>
      );
    } else if (confidence >= 60) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          Confiance moyenne ({confidence}%)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
          Confiance faible ({confidence}%)
        </Badge>
      );
    }
  };

  if (!suggestions || (suggestions as AISuggestion[]).length === 0) {
    return (
      <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Actions suggérées par l'IA
          </CardTitle>
          <CardDescription>
            Aucune suggestion en attente pour le moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 bg-purple-500/10 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              L'IA surveille vos appels manqués et prospects inactifs.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Actions suggérées par l'IA
            <Badge variant="secondary" className="ml-auto">
              {(suggestions as AISuggestion[]).length}
            </Badge>
          </CardTitle>
          <CardDescription>
            L'IA a détecté des opportunités nécessitant votre validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(suggestions as AISuggestion[]).map((suggestion: AISuggestion) => (
            <div
              key={suggestion.id}
              className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
                  {getTypeIcon(suggestion.type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {suggestion.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {getTypeLabel(suggestion.type)}
                    </Badge>
                  </div>

                  {suggestion.suggestedAction.content && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="text-sm font-medium mb-1">Message suggéré :</p>
                      <p className="text-sm text-foreground/80 italic">
                        "{suggestion.suggestedAction.content}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{suggestion.aiReasoning}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getConfidenceBadge(suggestion.confidence)}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => handleApprove(suggestion.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approuver & Envoyer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleEdit(suggestion)}
                    >
                      <Edit3 className="w-4 h-4" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => handleReject(suggestion.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="w-4 h-4" />
                      Refuser
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dialog de modification */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la suggestion</DialogTitle>
            <DialogDescription>
              Vous pouvez personnaliser le message avant de l'envoyer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Message</label>
              <Textarea
                value={editedContent}
                onChange={(e: any) => setEditedContent(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {editedContent.length} caractères
              </p>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>⚠️ Rappel :</strong> Ne mentionnez pas de prix, tarifs ou
                engagements contractuels.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={modifyMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}