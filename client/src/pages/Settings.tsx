import { useState } from "react";
import { Settings as SettingsIcon, 
  User,
  Lock,
  Bell,
  Users,
  Palette,
  Save,
  LogOut,
  Check,
  Briefcase,
  CreditCard,
  Activity,
  LayoutGrid
 } from 'lucide-react';
import { BusinessConfigPanel } from "@/components/BusinessConfigPanel";
import { BusinessEntitiesManager } from "@/components/BusinessEntitiesManager";
import { POSConfigPanel } from "@/components/POSConfigPanel";
import { IntegrationMarketplace } from "@/components/IntegrationMarketplace";
import { RealTimeWorkflowMonitor } from "@/components/RealTimeWorkflowMonitor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("marketplace");
  const [_language, _setLanguage] = useState("fr");
  const [_notifications, _setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
  });

  const handleSaveProfile = () => {
    toast.success("Profil enregistré avec succès");
  };

  const handleSaveSettings = () => {
    toast.success("Paramètres d'apparence enregistrés");
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in max-w-4xl" data-main-content>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Paramètres</h1>
        </div>
        <p className="text-muted-foreground">
          Gérez votre profil, vos préférences et vos intégrations.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-9 bg-muted/50 p-1 rounded-xl border border-border">
          <TabsTrigger value="marketplace" className="gap-2 rounded-lg">
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Apps</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 rounded-lg">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 rounded-lg">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Sécurité</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 rounded-lg">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notif.</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 rounded-lg">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Apparence</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 rounded-lg">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Équipe</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2 rounded-lg">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">Métier</span>
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2 rounded-lg">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Caisse</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2 rounded-lg">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Monitoring</span>
          </TabsTrigger>
        </TabsList>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-4 pt-4">
          <IntegrationMarketplace onConfigurePOS={() => setActiveTab("pos")} />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 pt-4">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Informations Personnelles</CardTitle>
              <CardDescription>
                Mettez à jour vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-white text-2xl font-bold border-4 border-primary/10">
                  JD
                </div>
                <Button variant="outline" size="sm">Changer l'avatar</Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input id="firstName" defaultValue="Jean" className="bg-muted/30 border-none" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input id="lastName" defaultValue="Dupont" className="bg-muted/30 border-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="jean@servicall.com" className="bg-muted/30 border-none" />
                </div>
                <Button onClick={handleSaveProfile} className="gap-2 shadow-lg shadow-primary/20">
                  <Save className="w-4 h-4" />
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4 pt-4">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Apparence</CardTitle>
              <CardDescription>Personnalisez votre interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Light Theme Option */}
                <div 
                  onClick={() => setTheme("light")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all cursor-pointer relative group",
                    theme === "light" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className="w-full h-24 bg-slate-100 rounded-lg mb-3 border border-slate-200 overflow-hidden">
                    <div className="h-4 bg-white border-b border-slate-200 px-2 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                      <div className="w-4 h-1 rounded-full bg-slate-200" />
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="w-full h-2 bg-white rounded shadow-sm" />
                      <div className="w-2/3 h-2 bg-white rounded shadow-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">Mode Clair</p>
                    {theme === "light" && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </div>

                {/* Dark Theme Option */}
                <div 
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all cursor-pointer relative group",
                    theme === "dark" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className="w-full h-24 bg-slate-900 rounded-lg mb-3 border border-slate-800 overflow-hidden">
                    <div className="h-4 bg-slate-800 border-b border-slate-700 px-2 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                      <div className="w-4 h-1 rounded-full bg-slate-700" />
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="w-full h-2 bg-slate-800 rounded shadow-sm" />
                      <div className="w-2/3 h-2 bg-slate-800 rounded shadow-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">Mode Sombre</p>
                    {theme === "dark" && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Persistance du thème</p>
                  <p className="text-xs text-muted-foreground">Votre choix sera mémorisé sur cet appareil.</p>
                </div>
                <Button onClick={handleSaveSettings} variant="outline" size="sm" className="gap-2">
                  <Save className="w-4 h-4" />
                  Confirmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-4 pt-4">
          <BusinessConfigPanel />
          <BusinessEntitiesManager />
        </TabsContent>

        {/* POS Tab */}
        <TabsContent value="pos" className="space-y-4 pt-4">
          <POSConfigPanel />
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4 pt-4">
          <RealTimeWorkflowMonitor />
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-red-600 text-lg">Zone Dangereuse</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="gap-2">
            <LogOut className="w-4 h-4" />
            Supprimer le compte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
