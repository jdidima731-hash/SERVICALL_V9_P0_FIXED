import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { TrendingUp, Target, AlertCircle, MessageSquare, Users, Award  } from 'lucide-react';

const conversionData = [
  { name: 'Agent A', conversion: 24, calls: 120 },
  { name: 'Agent B', conversion: 18, calls: 95 },
  { name: 'Agent C', conversion: 32, calls: 110 },
  { name: 'IA Assist', conversion: 28, calls: 450 },
];

const objectionData = [
  { name: 'Prix', value: 45 },
  { name: 'Délai', value: 25 },
  { name: 'Concurrence', value: 20 },
  { name: 'Fonctionnalité', value: 10 },
];

const radarData = [
  { subject: 'Sentiment', A: 80, fullMark: 100 },
  { subject: 'Engagement', A: 70, fullMark: 100 },
  { subject: 'Clarté', A: 90, fullMark: 100 },
  { subject: 'Conversion', A: 65, fullMark: 100 },
  { subject: 'Satisfaction', A: 85, fullMark: 100 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const BusinessIntelligenceDashboard: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Intelligence Métier & Insights
        </h1>
        <div className="flex gap-2">
          <Badge variant="secondary">Derniers 30 jours</Badge>
          <Badge variant="outline" className="text-primary border-primary">Export PDF</Badge>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow border-none bg-blue-50/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Score Lead Moyen</p>
                <p className="text-3xl font-bold text-blue-900 tracking-tight">74/100</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-green-50/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Taux de Conversion</p>
                <p className="text-3xl font-bold text-green-900 tracking-tight">22.5%</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-purple-50/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Objections Résolues</p>
                <p className="text-3xl font-bold text-purple-900 tracking-tight">68%</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-orange-50/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Alertes Sentiment</p>
                <p className="text-3xl font-bold text-orange-900 tracking-tight">12</p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion by Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Performance de Conversion par Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="conversion" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Taux de Conversion %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Objections Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Répartition des Objections
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={objectionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {objectionData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {objectionData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analyse Qualitative Globale</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Performance" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Derniers Insights & Recommandations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-start">
                  <Badge className="bg-blue-100 text-blue-700">Insight</Badge>
                  <span className="text-[10px] text-muted-foreground">Il y a 10 min</span>
                </div>
                <p className="text-sm mt-2 font-medium">L'objection "Prix" est en hausse de 15% ce matin. Suggérer l'argumentaire sur le ROI à long terme.</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex justify-between items-start">
                  <Badge className="bg-green-100 text-green-700">Opportunité</Badge>
                  <span className="text-[10px] text-muted-foreground">Il y a 25 min</span>
                </div>
                <p className="text-sm mt-2 font-medium">3 prospects à haut score ( &gt; 85) n'ont pas été rappelés depuis 48h. Déclenchement automatique d'une tâche de relance.</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="flex justify-between items-start">
                  <Badge className="bg-orange-100 text-orange-700">Alerte</Badge>
                  <span className="text-[10px] text-muted-foreground">Il y a 1h</span>
                </div>
                <p className="text-sm mt-2 font-medium">Sentiment négatif détecté sur l'appel #4582. Recommandation : Transfert immédiat au manager.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
