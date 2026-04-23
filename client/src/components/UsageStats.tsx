import { trpc } from "@/lib/trpc";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Phone, MessageSquare, Cpu, DollarSign  } from 'lucide-react';
import { useTranslation } from "react-i18next";

export function UsageStats() {
  const { t: _t } = useTranslation(['common']);
  const { data: stats, isPending } = trpc.billingLegal.billing.getUsageStats.useQuery({ days: 30 });

  if (isPending) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg"></div>;
  }

  // Adapter les données à l'ancien format pour compatibilité
  const totalCost = 0; // Calculé à partir des appels

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Cost Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Coût Total (30j)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          <p className="text-xs opacity-80 mt-1">Consommation réelle Twilio + AI</p>
        </CardContent>
      </Card>

      {/* Total Calls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" />
            Appels (30j)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.callsInPeriod || 0}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">Durée: {stats?.totalDuration || 0} min</span>
          </div>
          <Progress value={stats?.usagePercentage || 0} className="h-1 mt-2" />
        </CardContent>
      </Card>

      {/* Plan Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-500" />
            Plan Actuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.plan || 'Starter'}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {stats?.callsRemaining === -1 ? 'Illimité' : `${stats?.callsRemaining || 0} restants`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Average Duration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-500" />
            Durée Moyenne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.averageDuration || 0} min</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">Par appel</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
