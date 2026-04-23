import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft  } from 'lucide-react';

export default function Terms() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Button 
        variant="ghost" 
        onClick={() => setLocation("/")} 
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à l'accueil
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Conditions d'Utilisation</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p className="text-muted-foreground">Dernière mise à jour : 12 Mars 2026</p>
          
          <h2>1. Acceptation des conditions</h2>
          <p>
            En accédant à Servicall, vous acceptez d'être lié par les présentes conditions d'utilisation. 
            Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser nos services.
          </p>
          
          <h2>2. Utilisation du service</h2>
          <p>
            Vous vous engagez à utiliser Servicall de manière licite et conforme aux lois en vigueur, 
            notamment en ce qui concerne l'enregistrement des appels et la protection des données personnelles.
          </p>
          
          <h2>3. Propriété intellectuelle</h2>
          <p>
            Tous les contenus, marques et technologies de Servicall sont la propriété exclusive de Servicall ou de ses concédants. 
            Toute reproduction ou utilisation non autorisée est strictement interdite.
          </p>
          
          <h2>4. Limitation de responsabilité</h2>
          <p>
            Servicall s'efforce de fournir un service de haute qualité mais ne peut garantir une disponibilité ininterrompue. 
            Nous ne serons pas responsables des dommages indirects résultant de l'utilisation de nos services.
          </p>
          
          <h2>5. Modifications</h2>
          <p>
            Nous nous réservons le droit de modifier ces conditions à tout jour. 
            L'utilisation continue du service après modification constitue votre acceptation des nouvelles conditions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
