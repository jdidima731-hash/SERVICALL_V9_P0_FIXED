import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, LogOut, User  } from 'lucide-react';
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Connected() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Redirection automatique vers le dashboard après connexion réussie
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setLocation("/dashboard");
      }, 1500); // Redirection après 1.5 secondes pour laisser voir le message de succès
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [user, setLocation]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const goToDashboard = () => {
    setLocation("/dashboard");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Connexion réussie</CardTitle>
          <CardDescription>
            Vous êtes maintenant connecté à Servicall CRM v2
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <User className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              
              <p className="text-sm font-medium">{(user as any).name || "Utilisateur"}</p>
              
              <p className="text-xs text-muted-foreground">{(user as any).email || `ID: ${(user as any).id}`}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={goToDashboard} 
              className="w-full"
              size="lg"
            >
              Accéder au tableau de bord
            </Button>
            
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              className="w-full"
              size="lg"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}