import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, 
  Globe, 
  Building2, 
  Download, 
  Loader2, 
  Zap, 
  User, 
  Map, 
  History, 
  FileSpreadsheet,
  PlusCircle
 } from 'lucide-react';
import { useCallStore } from '@/lib/callStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * LEAD EXTRACTION PAGE — SERVICALL V8
 * ✅ Recherche de prospects B2B & B2C
 * ✅ FIX V8 : Typage strict et suppression du @ts-nocheck
 */

// ── Types & Schema ──────────────────────────────────────────

type BusinessSource = 'osm' | 'google' | 'pagesjaunes' | 'servicall' | 'b2c';

interface Business {
  _source: BusinessSource;
  _externalId: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  rating?: number;
}

const searchSchema = z.object({
  query: z.string().min(1, 'Entrez un type d\'activité'),
  location: z.string().min(1, 'Entrez une ville'),
  radius: z.number().default(5000),
  maxResults: z.number().default(20),
  provider: z.enum(['osm', 'google', 'pagesjaunes', 'servicall', 'b2c', 'auto']).default('auto'),
  housingType: z.enum(['house', 'apartment', 'all']).default('all'),
  estimatedIncome: z.enum(['low', 'medium', 'high', 'very_high', 'all']).default('all'),
  hasChildren: z.boolean().default(false),
  propertyStatus: z.enum(['owner', 'tenant', 'all']).default('all'),
  ageRange: z.string().default('all'),
});

type SearchFormValues = z.infer<typeof searchSchema>;

const PROVIDER_CONFIG: Record<BusinessSource, { label: string; color: string; icon: any }> = {
  osm:         { label: 'OpenStreetMap',  color: 'bg-green-100 text-green-700',  icon: Map },
  google:      { label: 'Google Maps',    color: 'bg-blue-100 text-blue-700',     icon: Globe },
  pagesjaunes: { label: 'Pages Jaunes',   color: 'bg-yellow-100 text-yellow-700', icon: Building2 },
  servicall:   { label: 'Servicall Hybrid', color: 'bg-violet-100 text-violet-700', icon: Zap },
  b2c:         { label: 'B2C Scraper',    color: 'bg-pink-100 text-pink-700',     icon: User },
};

export default function LeadExtraction() {
  const [results, setResults] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('search');
  
  const utils = trpc.useUtils();
  const callStore = useCallStore();
  const { data: config } = trpc.aiAutomation.leadExtraction.getApiKeys.useQuery();
  const { data: history } = trpc.aiAutomation.leadExtraction.history.useQuery({ limit: 10 });

  const searchMutation = trpc.aiAutomation.leadExtraction.search.useMutation({
    onSuccess: (data: any) => {
      const businesses = (data?.businesses ?? data?.data?.businesses ?? []) as Business[];
      setResults(businesses);
      if (data.error) toast.warning(data.error);
      else toast.success(`${businesses.length} résultat(s) trouvé(s)`);
      
      utils.aiAutomation.leadExtraction.history.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const importMutation = trpc.aiAutomation.leadExtraction.importProspects.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || "Import réussi");
      setSelected(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { 
      query: '', 
      location: '', 
      radius: 5000, 
      maxResults: 20, 
      provider: 'auto',
      housingType: 'all',
      estimatedIncome: 'all',
      hasChildren: false,
      propertyStatus: 'all',
      ageRange: 'all',
    },
  });

  const toggleAll = () => {
    if (selected.size === results.length && results.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map(r => r._externalId)));
    }
  };

  const handleImport = () => {
    const toImport = results.filter(r => selected.has(r._externalId));
    if (toImport.length === 0) {
      toast.error("Veuillez sélectionner au moins un prospect");
      return;
    }
    importMutation.mutate({ businesses: toImport });
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    const headers = ['Nom', 'Source', 'Adresse', 'Ville', 'Téléphone', 'Email', 'Catégorie', 'Site Web'];
    const rows = results.map(r => [
      r.name,
      r._source,
      r.address,
      r.city,
      r.phone || '',
      r.email || '',
      r.category || '',
      r.website || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extraction_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export CSV réussi');
  };

  return (
    <div className='p-6 space-y-6 max-w-7xl mx-auto'>
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-bold flex items-center gap-2'>
            <Search className='text-violet-600' /> Extraction de Leads B2B & B2C
          </h1>
          <p className='text-slate-500'>Trouvez des prospects qualifiés via OSM, Google, Pages Jaunes et Scraping B2C.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full max-w-md grid-cols-2'>
          <TabsTrigger value='search' className='gap-2'><Search size={14} /> Recherche</TabsTrigger>
          <TabsTrigger value='history' className='gap-2'><History size={14} /> Historique</TabsTrigger>
        </TabsList>

        <TabsContent value='search' className='space-y-6 mt-4'>
          <Card className='border-violet-100 shadow-sm'>
            <CardHeader className='pb-3'>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className='text-lg'>Paramètres de recherche</CardTitle>
                  <CardDescription>Configurez votre recherche pour extraire des données fraîches.</CardDescription>
                </div>
                <div className="flex gap-2">
                  {(config as any)?.hasGoogleKey && <Badge className="bg-blue-100 text-blue-700 border-blue-200">Google Active</Badge>}
                  {(config as any)?.hasPagesJaunesKey && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">PJ Active</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => searchMutation.mutate(d as any))} className='space-y-6'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <FormField control={form.control} name='query' render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activité / Nom</FormLabel>
                        <FormControl><Input placeholder='ex: Plombier, Restaurant, Jean Dupont...' {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name='location' render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville / Localisation</FormLabel>
                        <FormControl><Input placeholder='ex: Paris, Lyon, 69001...' {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className='flex justify-end gap-2'>
                    <Button type='submit' disabled={searchMutation.isPending} className='bg-violet-600 hover:bg-violet-700 gap-2'>
                      {searchMutation.isPending ? <Loader2 className='animate-spin' size={16} /> : <Search size={16} />}
                      Lancer l'extraction
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader className='flex flex-row items-center justify-between'>
                <div>
                  <CardTitle className='text-lg'>Résultats ({results.length})</CardTitle>
                  <CardDescription>{selected.size} prospect(s) sélectionné(s)</CardDescription>
                </div>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={handleExportCSV} className='gap-2'>
                    <FileSpreadsheet size={14} /> Export CSV
                  </Button>
                  <Button size='sm' onClick={handleImport} disabled={importMutation.isPending || selected.size === 0} className='gap-2 bg-green-600 hover:bg-green-700'>
                    {importMutation.isPending ? <Loader2 className='animate-spin' size={14} /> : <PlusCircle size={14} />}
                    Importer {selected.size} leads
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-[40px]'><Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r._externalId}>
                        <TableCell>
                          <Checkbox 
                            checked={selected.has(r._externalId)} 
                            onCheckedChange={(checked) => {
                              const next = new Set(selected);
                              if (checked) next.add(r._externalId);
                              else next.delete(r._externalId);
                              setSelected(next);
                            }} 
                          />
                        </TableCell>
                        <TableCell className='font-medium'>{r.name}</TableCell>
                        <TableCell className='text-sm text-slate-500'>{r.city}</TableCell>
                        <TableCell>
                          <Badge variant='outline' className={cn('text-[10px]', PROVIDER_CONFIG[r._source]?.color)}>
                            {PROVIDER_CONFIG[r._source]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button variant='ghost' size='sm' onClick={() => {
                            if (r.phone) {
                              callStore.initiateCall({ phoneNumber: r.phone, prospectName: r.name });
                            }
                          }} disabled={!r.phone}>
                            <Search size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
