/**
 * PAGE — Intelligence Centrale Servicall v2
 * Wrapper de page pour le composant ServicecallV3Central
 */
import ServicecallV3Central from "@/components/ServicecallV3Central";

export default function IntelligenceCentrale() {
  return (
    <div className="p-6 max-w-7xl mx-auto" data-main-content>
      <ServicecallV3Central />
    </div>
  );
}
