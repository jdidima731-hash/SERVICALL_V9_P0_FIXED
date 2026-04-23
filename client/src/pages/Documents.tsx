import DashboardLayout from "@/components/DashboardLayout";
import { DocumentManager } from "@/components/DocumentManager";
import { useTranslation } from "react-i18next";

/**
 * Page Documents - Gestion des documents (photos, scans, contrats)
 * Accessible via /documents
 */
export default function Documents() {
  const { t } = useTranslation("common");

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6" data-main-content>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("nav.documents", "Documents")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("documents.subtitle", "Gérez vos photos, scans et documents contractuels")}
            </p>
          </div>
        </div>
        <DocumentManager />
      </div>
    </DashboardLayout>
  );
}
