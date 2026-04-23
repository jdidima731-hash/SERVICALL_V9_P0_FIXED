import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft  } from 'lucide-react';

export default function Privacy() {
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
          <CardTitle className="text-3xl font-bold">Politique de Confidentialité</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p className="text-muted-foreground">Dernière mise à jour : 12 Mars 2026</p>
          
          <h2>1. Collecte des données</h2>
          <p>
            Servicall collecte les informations nécessaires à la fourniture de ses services de CRM et d'IA vocale. 
            Cela inclut les données d'identification, les enregistrements d'appels (avec consentement) et les données d'utilisation.
          </p>
          
          <h2>2. Utilisation des données</h2>
          <p>
            Vos données sont utilisées pour :
          </p>
          <ul>
            <li>Fournir et améliorer nos services d'IA</li>
            <li>Gérer votre compte et la facturation</li>
            <li>Assurer la sécurité de la plateforme</li>
            <li>Respecter nos obligations légales</li>
          </ul>
          
          <h2>3. Protection des données</h2>
          <p>
            Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles rigoureuses pour protéger vos données, 
            notamment le chiffrement de bout en bout et l'isolation des tenants.
          </p>
          
          <h2>4. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. 
            Vous pouvez exercer ces droits via votre tableau de bord ou en nous contactant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
