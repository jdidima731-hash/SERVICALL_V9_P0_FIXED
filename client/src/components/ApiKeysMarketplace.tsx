import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Key, Map, Building2, ShieldCheck, Loader2, Save, ExternalLink, AlertCircle  } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ApiKeysMarketplace() {
  const [googleKey, setGoogleKey] = useState('');
  const [pjKey, setPjKey] = useState('');
  
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.aiAutomation.leadExtraction.getApiKeys.useQuery();
  
  const saveMutation = trpc.aiAutomation.leadExtraction.saveApiKeys.useMutation({
    onSuccess: () => {
      toast.success('Clés API sauvegardées avec succès');
      
      utils.aiAutomation.leadExtraction.getApiKeys.invalidate();
      setGoogleKey('');
      setPjKey('');
    },
    onError: (err) => {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    }
  });

  const handleSave = () => {
    if (!googleKey && !pjKey) {
      toast.error('Veuillez saisir au moins une clé API');
      return;
    }
    saveMutation.mutate({
      googleMapsApiKey: googleKey || undefined,
      pagesJaunesApiKey: pjKey || undefined
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        <p className="text-sm text-slate-500">Chargement de vos configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
        <div className="p-2 bg-violet-100 rounded-lg shrink-0">
          <ShieldCheck className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-violet-900">Mode BYOK (Bring Your Own Key)</h3>
          <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">
            Utilisez vos propres accès API pour une extraction sans limites. Vos clés sont chiffrées (AES-256) 
            et stockées en toute sécurité. Elles ne sont utilisées que pour vos propres recherches.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Maps Card */}
        <Card className={cn("border-slate-200 shadow-sm overflow-hidden", config?.hasGoogleKey && "border-blue-200")}>
          <CardHeader className="pb-3 bg-slate-50/50">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Map className="w-5 h-5 text-blue-600" />
              </div>
              {config?.hasGoogleKey ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                  Actif : {config.googleKeyMasked}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500">Non configuré</Badge>
              )}
            </div>
            <CardTitle className="mt-3 text-base">Google Maps Places</CardTitle>
            <CardDescription className="text-xs">
              Extraction B2B mondiale ultra-précise avec horaires et avis.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google-key" className="text-xs font-medium">Clé API Google Cloud</Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="google-key"
                  type="password"
                  placeholder="AIzaSy..."
                  className="pl-9 text-sm"
                  value={googleKey}
                  onChange={(e: any) => setGoogleKey(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <AlertCircle size={10} /> Requis : Places API (New) & Geocoding API
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/30 border-t py-3">
            <a 
              href="https://console.cloud.google.com/google/maps-apis/credentials" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
            >
              Console Google <ExternalLink size={10} />
            </a>
          </CardFooter>
        </Card>

        {/* Pages Jaunes Card */}
        <Card className={cn("border-slate-200 shadow-sm overflow-hidden", config?.hasPagesJaunesKey && "border-yellow-200")}>
          <CardHeader className="pb-3 bg-slate-50/50">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Building2 className="w-5 h-5 text-yellow-600" />
              </div>
              {config?.hasPagesJaunesKey ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                  Actif : {config.pagesJaunesKeyMasked}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500">Non configuré</Badge>
              )}
            </div>
            <CardTitle className="mt-3 text-base">Pages Jaunes API</CardTitle>
            <CardDescription className="text-xs">
              La référence pour les entreprises en France (SIRET, Emails).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pj-key" className="text-xs font-medium">Clé API Partenaire PJ</Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="pj-key"
                  type="password"
                  placeholder="votre_cle_api_pj"
                  className="pl-9 text-sm"
                  value={pjKey}
                  onChange={(e: any) => setPjKey(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <AlertCircle size={10} /> Requis : Accès Search API entreprise
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/30 border-t py-3">
            <a 
              href="https://developer.pagesjaunes.fr/" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-yellow-700 hover:underline"
            >
              Portail Dev PJ <ExternalLink size={10} />
            </a>
          </CardFooter>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending || (!googleKey && !pjKey)}
          className="bg-violet-600 hover:bg-violet-700 min-w-[150px]"
        >
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Enregistrer les clés</>
          )}
        </Button>
      </div>
    </div>
  );
}