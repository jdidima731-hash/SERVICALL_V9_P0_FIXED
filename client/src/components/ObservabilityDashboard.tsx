import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';
import { Activity, ShieldAlert, Server, Clock  } from 'lucide-react';

const performanceData = [
  { time: '10:00', latency: 120, errors: 0 },
  { time: '10:05', latency: 145, errors: 1 },
  { time: '10:10', latency: 132, errors: 0 },
  { time: '10:15', latency: 450, errors: 5 },
  { time: '10:20', latency: 180, errors: 2 },
  { time: '10:25', latency: 150, errors: 0 },
  { time: '10:30', latency: 140, errors: 0 },
];

const systemMetrics = [
  { name: 'CPU', value: 42, color: '#3b82f6' },
  { name: 'RAM', value: 68, color: '#10b981' },
  { name: 'Disk', value: 24, color: '#f59e0b' },
];

export const ObservabilityDashboard: React.FC = () => {
  const [activeAlerts, _setActiveAlerts] = useState([
    { id: 1, msg: "Latence élevée sur l'API Voice", severity: "high", time: "Il y a 2 min" },
    { id: 2, msg: "Taux d'erreur > 5% sur le module Workflow", severity: "critical", time: "Il y a 5 min" },
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Observabilité Système & SRE
        </h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            v2.0.0-prod
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Cluster: EU-WEST-1
          </Badge>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Disponibilité (SLO)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">99.98%</div>
            <div className="w-full bg-muted h-2 rounded-full mt-3">
              <div className="bg-green-500 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" style={{ width: '99.98%' }} />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Latence Moyenne (p95)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">142ms</div>
            <div className="mt-3 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
              <span>↓ 12ms vs heure précédente</span>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux d'Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-red-600">0.42%</div>
            <div className="mt-3 flex items-center text-xs font-medium text-muted-foreground bg-muted w-fit px-2 py-1 rounded-full">
              <span>Seuil d'alerte: 2.0%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Latence API & Erreurs (Temps Réel)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="latency" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLatency)" name="Latence (ms)" />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} name="Erreurs" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-4 w-4" /> Alertes Actives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeAlerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-lg border ${alert.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex justify-between items-start">
                  <p className={`text-xs font-bold ${alert.severity === 'critical' ? 'text-red-700' : 'text-orange-700'}`}>
                    {alert.severity.toUpperCase()}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                </div>
                <p className="text-sm mt-1 font-medium">{alert.msg}</p>
              </div>
            ))}
            <Button variant="outline" className="w-full text-xs h-8">Voir tout l'historique</Button>
          </CardContent>
        </Card>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" /> Ressources Serveur
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={systemMetrics} layout="vertical">
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={40} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {systemMetrics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Logs Récents (Streaming)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-[10px] text-green-400 h-[200px] overflow-y-auto space-y-1">
              <p>[10:32:01] INFO: Request processed: GET /api/calls (tenant=1) 45ms</p>
              <p>[10:32:05] INFO: Voice AI: Transcription received (call=v_123) "Bonjour..."</p>
              <p className="text-yellow-400">[10:32:10] WARN: High latency detected on POST /api/workflow (duration=1200ms)</p>
              <p>[10:32:15] INFO: Workflow executed: send_sms (tenant=1, status=success)</p>
              <p className="text-red-400">[10:32:20] ERROR: Failed to connect to Deepgram ASR (retry=1/3)</p>
              <p>[10:32:25] INFO: Request processed: GET /api/metrics (tenant=1) 12ms</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
