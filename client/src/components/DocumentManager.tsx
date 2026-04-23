import React, { useState, useRef } from "react";
import { logger } from "@/lib/logger";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, FileText, Loader2, Eye, Trash2  } from 'lucide-react';
import { toast } from "sonner";

interface DocumentManagerProps {
  prospectId?: number;
  propertyId?: number;
}

export function DocumentManager({ prospectId, propertyId }: DocumentManagerProps) {
  // const {_tenantId} = useTenant();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();
  
  // Queries & Mutations
  const { data: docs, isPending: docsLoading } = trpc.documents.list.useQuery({
    prospectId,
    propertyId
  });

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: (data: any) => {
      toast.success("Document enregistré avec succès");
      if (data.ocrData) {
        toast.info("Analyse IA terminée : Données extraites");
        logger.info("OCR Data:", data.ocrData);
      }
      setPreview(null);
      utils.documents.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erreur lors de l'upload: ${error.message}`);
    },
    onSettled: () => setIsUploading(false)
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (type: "photo" | "scan" | "id_card", runOCR: boolean = false) => {
    if (!preview) return;
    
    setIsUploading(true);
    await uploadMutation.mutateAsync({ 
      fileName: `capture_${Date.now()}.jpg`,
      base64Data: preview,
      type,
      prospectId,
      propertyId,
      runOCR
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Capture Terrain (Photo / Scan)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview Area */}
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary/50 bg-muted aspect-video flex items-center justify-center">
              <img src={preview} alt="Preview" className="max-h-full object-contain" />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2"
                onClick={() => setPreview(null)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div 
              className="rounded-lg border-2 border-dashed border-muted-foreground/25 aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Cliquez pour prendre une photo ou uploader</p>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Action Buttons */}
          {preview && (
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                disabled={isUploading}
                onClick={() => handleUpload("photo")}
              >
                <Camera className="w-4 h-4" />
                Photo Simple
              </Button>
              <Button 
                className="gap-2"
                disabled={isUploading}
                onClick={() => handleUpload("scan", true)}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Scanner avec IA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents Récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : docs?.data && (docs.data as Record<string, unknown>[]).length > 0 ? (
              (docs.data as Record<string, unknown>[]).map((doc) => (
                <div key={doc.id as string} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded border">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px]">{String(doc.name ?? '')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt as string).toLocaleDateString()} • {String(doc.type ?? '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    
                    {String(doc.ocrData && <Badge variant="secondary" className="text-[10px]">IA Analysé</Badge>)}
                    <Button variant="ghost" size="icon" asChild>
                      <a href={doc.fileUrl as string} target="_blank" rel="noreferrer">
                        <Eye className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">Aucun document pour le moment.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}