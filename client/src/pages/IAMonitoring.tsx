/**
 * IAMonitoring — Page wrapper pour le dashboard de monitoring IA
 * Route: /ia-monitoring
 */
import { IAMonitoringDashboard } from "@/components/IAMonitoringDashboard";

export default function IAMonitoringPage() {
  return (
    <div data-main-content>
      <IAMonitoringDashboard />
    </div>
  );
}
