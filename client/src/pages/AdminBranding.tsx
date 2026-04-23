import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Layout, Save, Upload, CheckCircle2  } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function AdminBranding() {
  const { branding, updateBranding } = useTheme();
  const [formData, setFormData] = useState(branding);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    updateBranding(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personnalisation (White Label)</h1>
          <p className="text-muted-foreground">Configurez l'apparence de votre plateforme pour vos clients.</p>
        </div>
        {isSaved && (
          <Badge className="bg-green-100 text-green-800 border-green-200 flex gap-1 items-center py-1 px-3">
            <CheckCircle2 className="h-4 w-4" />
            Paramètres enregistrés
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                Identité de la Marque
              </CardTitle>
              <CardDescription>Nom de l'application et logo personnalisé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Nom de l'application</Label>
                <Input 
                  id="appName" 
                  value={(formData as any)?.appName} 
                  onChange={(e: any) => setFormData({...formData, appName: e.target.value})}
                  placeholder="Ex: MaPlateforme IA"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Logo de l'entreprise</Label>
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cliquez pour uploader votre logo</p>
                    <p className="text-xs text-muted-foreground">PNG, SVG ou JPG (max. 2MB)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Thème Visuel
              </CardTitle>
              <CardDescription>Couleurs et styles globaux</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Couleur Primaire</Label>
                <div className="flex gap-3">
                  <Input 
                    id="primaryColor" 
                    type="color" 
                    className="w-12 h-10 p-1 cursor-pointer"
                    value={formData.primaryColor}
                    onChange={(e: any) => setFormData({...formData, primaryColor: e.target.value})}
                  />
                  <Input 
                    value={formData.primaryColor}
                    onChange={(e: any) => setFormData({...formData, primaryColor: e.target.value})}
                    className="font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Cette couleur sera appliquée aux boutons, liens et éléments actifs.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="gap-2 px-8">
              <Save className="h-4 w-4" />
              Enregistrer les modifications
            </Button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Aperçu en temps réel</h3>
          <Card className="overflow-hidden border-2 border-primary/20 shadow-xl">
            <div className="h-12 border-b flex items-center px-4 justify-between" style={{ backgroundColor: formData.primaryColor + '10' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center" style={{ backgroundColor: formData.primaryColor }}>
                  <span className="text-[10px] text-white font-bold">{(formData as any)?.appName.charAt(0)}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: formData.primaryColor }}>{(formData as any)?.appName}</span>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <div className="w-2 h-2 rounded-full bg-muted" />
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-2 w-full bg-muted/50 rounded animate-pulse" />
                <div className="h-2 w-5/6 bg-muted/50 rounded animate-pulse" />
              </div>
              <Button className="w-full h-8 text-xs" style={{ backgroundColor: formData.primaryColor }}>
                Bouton d'action
              </Button>
              <div className="pt-4 border-t flex justify-center">
                <p className="text-[8px] text-muted-foreground">© 2026 {(formData as any)?.appName}</p>
              </div>
            </CardContent>
          </Card>
          
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Note:</strong> Ces paramètres sont persistés en base de données pour votre Tenant et seront appliqués à tous vos utilisateurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
