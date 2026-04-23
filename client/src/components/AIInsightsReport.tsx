import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, TrendingUp, CheckCircle2  } from 'lucide-react';

interface Insight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface AIInsightsReportProps {
  insights?: Insight[];
  isLoading?: boolean;
}

export const AIInsightsReport: React.FC<AIInsightsReportProps> = ({ 
  insights = [
    {
      title: "Objection récurrente sur le prix",
      description: "Les clients hésitent souvent lors de l'annonce des tarifs premium.",
      impact: "high",
      recommendation: "Suggérer d'insister sur la garantie de satisfaction pour lever l'objection."
    },
    {
      title: "Hésitation sur les délais de livraison",
      description: "Plusieurs appels mentionnent une incertitude sur les délais d'expédition.",
      impact: "medium",
      recommendation: "Mettre à jour le script IA pour confirmer les délais dès le début de l'échange."
    }
  ], 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader>
          <div className="h-6 w-1/3 bg-muted rounded mb-2"></div>
          <div className="h-4 w-1/2 bg-muted rounded"></div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-muted rounded"></div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="w-full border-primary/20 shadow-lg">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Audit de Performance IA</CardTitle>
              <CardDescription>Analyse hebdomadaire des transcriptions et conseils stratégiques</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-white">Hebdomadaire</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {insights.map((insight, index) => (
          <div key={index} className="group relative p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className={getImpactColor(insight.impact)}>
                  Impact {insight.impact.toUpperCase()}
                </Badge>
                <h3 className="font-semibold text-lg">{insight.title}</h3>
              </div>
              <div className="p-1.5 bg-muted rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {insight.description}
            </p>
            
            <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary mb-1">Conseil Stratégique</p>
                <p className="text-sm text-primary/80 italic">
                  "{insight.recommendation}"
                </p>
              </div>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-center pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Généré automatiquement par Servicall AI Analytics
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
