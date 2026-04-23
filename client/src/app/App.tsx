/**
 * APP.TSX — Routage complet Servicall V8
 * Toutes les 51 pages avec lazy loading + protection auth + sélection tenant
 */
import { Suspense, lazy } from "react";
import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/entities/user/model/useAuth";
import { useTenant } from "@/entities/tenant/model/TenantContext";
import { DashboardLayout } from "@/widgets/layout/DashboardLayout";
import { LoadingFallback } from "@/shared/ui/loading-state";

// ── Auth ────────────────────────────────────────────────────────────
const Login        = lazy(() => import("@/pages/Login"));
const Signup       = lazy(() => import("@/pages/Signup"));
const SelectTenant = lazy(() => import("@/pages/SelectTenant"));
const Privacy      = lazy(() => import("@/pages/Privacy"));
const Terms        = lazy(() => import("@/pages/Terms"));
const Connected    = lazy(() => import("@/pages/Connected"));

// ── Dashboard & CRM ─────────────────────────────────────────────────
const Dashboard          = lazy(() => import("@/pages/Dashboard"));
const Home               = lazy(() => import("@/pages/Home"));
const Prospects          = lazy(() => import("@/pages/Prospects"));
const ProspectDetail     = lazy(() => import("@/pages/ProspectDetail"));
const ProspectDetail360  = lazy(() => import("@/pages/ProspectDetail360"));
const Clients            = lazy(() => import("@/pages/Clients"));
const Leads              = lazy(() => import("@/pages/Leads"));
const Contact            = lazy(() => import("@/pages/Contact"));

// ── Appels & Téléphonie ──────────────────────────────────────────────
const Calls           = lazy(() => import("@/pages/Calls"));
const Softphone       = lazy(() => import("@/pages/Softphone"));
const RecordingPlayer = lazy(() => import("@/pages/RecordingPlayer"));
const CalendarView    = lazy(() => import("@/pages/CalendarView"));

// ── Campagnes & Marketing ────────────────────────────────────────────
const Campaigns      = lazy(() => import("@/pages/Campaigns"));
const CampaignWizard = lazy(() => import("@/pages/CampaignWizard"));
const LeadExtraction = lazy(() => import("@/pages/LeadExtraction"));
const B2CLeadExtraction = lazy(() => import("@/pages/B2CLeadExtraction"));
const SocialMediaManager = lazy(() => import("@/pages/SocialMediaManager"));
const UnifiedInbox   = lazy(() => import("@/pages/UnifiedInbox"));
const Messages       = lazy(() => import("@/pages/Messages"));

// ── Workflows ────────────────────────────────────────────────────────
const Workflows       = lazy(() => import("@/pages/Workflows"));
const WorkflowEditor  = lazy(() => import("@/pages/WorkflowEditor"));
const WorkflowsAdmin  = lazy(() => import("@/pages/WorkflowsAdmin"));

// ── IA & Analytics ───────────────────────────────────────────────────
const IAMonitoring          = lazy(() => import("@/pages/IAMonitoring"));
const IntelligenceCentrale  = lazy(() => import("@/pages/IntelligenceCentrale"));
const AgentDashboard        = lazy(() => import("@/pages/AgentDashboard"));
const ManagerDashboard      = lazy(() => import("@/pages/ManagerDashboard"));

const Coaching              = lazy(() => import("@/pages/Coaching"));
const AIRoleEditor          = lazy(() => import("@/pages/AIRoleEditor"));

// ── Recrutement ──────────────────────────────────────────────────────
const Recruitment = lazy(() => import("@/pages/Recruitment"));
const Training    = lazy(() => import("@/pages/Training"));

// ── Facturation & Paiements ──────────────────────────────────────────
const Billing               = lazy(() => import("@/pages/Billing"));
const BillingAdmin          = lazy(() => import("@/pages/BillingAdmin"));
const InvoiceCreation       = lazy(() => import("@/pages/InvoiceCreation"));
const InvoiceHistory        = lazy(() => import("@/pages/InvoiceHistory"));
const InvoiceAcceptancePage = lazy(() => import("@/pages/InvoiceAcceptancePage"));
const InvoicePaymentPage    = lazy(() => import("@/pages/InvoicePaymentPage"));

// ── Équipe & Admin ───────────────────────────────────────────────────
const TeamManager    = lazy(() => import("@/pages/TeamManager"));
const Settings       = lazy(() => import("@/pages/Settings"));
const AdminBranding  = lazy(() => import("@/pages/AdminBranding"));
const Tasks          = lazy(() => import("@/pages/Tasks"));
const Documents      = lazy(() => import("@/pages/Documents"));
const Compliance     = lazy(() => import("@/pages/Compliance"));
const ComplianceRGPD = lazy(() => import("@/pages/ComplianceRGPD"));

const NotFound  = lazy(() => import("@/pages/NotFound"));
const AdminPage = lazy(() => import("@/pages/admin"));

// ── Pages restaurées depuis référence ───────────────────────────────
const RecruitmentEnhanced     = lazy(() => import("@/pages/RecruitmentEnhanced"));
const RecruitmentInterviews   = lazy(() => import("@/pages/RecruitmentInterviews"));
const AgentSwitch             = lazy(() => import("@/pages/AgentSwitch"));
const WorkflowsAndAgentSwitch = lazy(() => import("@/pages/WorkflowsAndAgentSwitch"));

// ── Guards ───────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RequireTenant({ children }: { children: React.ReactNode }) {
  const { tenantId, isReady } = useTenant();
  if (!isReady) return <LoadingFallback />;
  if (!tenantId) return <Redirect to="/select-tenant" />;
  return <>{children}</>;
}

// ── App ──────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Routes publiques */}
        <Route path="/login"   component={Login} />
        <Route path="/signup"  component={Signup} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms"   component={Terms} />
        <Route path="/connected" component={Connected} />
        <Route path="/invoice/accept/:token" component={InvoiceAcceptancePage} />
        <Route path="/invoice/pay/:token"    component={InvoicePaymentPage} />

        {/* Sélection tenant (auth requise, pas de tenant encore) */}
        <Route path="/select-tenant">
          <RequireAuth>
            <SelectTenant />
          </RequireAuth>
        </Route>

        {/* Routes protégées — auth + tenant requis */}
        <Route path="/:rest*">
          <RequireAuth>
            <RequireTenant>
              <DashboardLayout>
                <Switch>
                  <Route path="/"           component={() => <Redirect to="/dashboard" />} />
                  <Route path="/dashboard"  component={Dashboard} />
                  <Route path="/home"       component={Home} />

                  {/* CRM */}
                  <Route path="/prospects"          component={Prospects} />
                  <Route path="/prospects/:id/360"  component={ProspectDetail360} />
                  <Route path="/prospects/:id"      component={ProspectDetail} />
                  <Route path="/clients"            component={Clients} />
                  <Route path="/leads"              component={Leads} />
                  <Route path="/contact"            component={Contact} />

                  {/* Téléphonie */}
                  <Route path="/calls"            component={Calls} />
                  <Route path="/softphone"        component={Softphone} />
                  <Route path="/recordings/:id"   component={RecordingPlayer} />
                  <Route path="/calendar"         component={CalendarView} />

                  {/* Campagnes */}
                  <Route path="/campaigns"              component={Campaigns} />
                  <Route path="/campaigns/wizard"       component={CampaignWizard} />
                  <Route path="/lead-extraction"        component={LeadExtraction} />
                  <Route path="/b2c-lead-extraction"    component={B2CLeadExtraction} />
                  <Route path="/social-media"           component={SocialMediaManager} />
                  <Route path="/inbox"                  component={UnifiedInbox} />
                  <Route path="/messages"               component={Messages} />

                  {/* Workflows */}
                  {/* ✅ FIX P1-C — Route canonique workflow */}
                  <Route path="/workflows"          component={WorkflowsAndAgentSwitch} />
                  <Route path="/workflows/:id"      component={WorkflowEditor} />
                  {/* Legacy redirects */}
                  <Route path="/workflows-admin">   <Redirect to="/workflows" /> </Route>

                  {/* IA & Analytics */}
                  <Route path="/ia-monitoring"          component={IAMonitoring} />
                  <Route path="/intelligence"           component={IntelligenceCentrale} />
                  <Route path="/agent-dashboard"        component={AgentDashboard} />
                  <Route path="/manager-dashboard"      component={ManagerDashboard} />
                  <Route path="/admin-dashboard">    <Redirect to="/admin" /> </Route>
                  <Route path="/admin"                   component={AdminPage} />
                  <Route path="/coaching"               component={Coaching} />
                  <Route path="/ai-roles"               component={AIRoleEditor} />

                  {/* Recrutement */}
                  <Route path="/recruitment" component={Recruitment} />
                  <Route path="/training"    component={Training} />

                  {/* Facturation */}
                  <Route path="/billing"         component={Billing} />
                  <Route path="/billing-admin"   component={BillingAdmin} />
                  <Route path="/invoices/new"    component={InvoiceCreation} />
                  <Route path="/invoices"        component={InvoiceHistory} />

                  {/* Admin & Équipe */}
                  <Route path="/team"        component={TeamManager} />
                  <Route path="/settings"    component={Settings} />
                  <Route path="/branding"    component={AdminBranding} />
                  <Route path="/tasks"       component={Tasks} />
                  <Route path="/documents"   component={Documents} />
                  <Route path="/compliance"  component={Compliance} />
                  <Route path="/rgpd"        component={ComplianceRGPD} />

                  {/* Recrutement étendu */}
                  <Route path="/recruitment/enhanced"   component={RecruitmentEnhanced} />
                  <Route path="/recruitment/interviews" component={RecruitmentInterviews} />

                  {/* Agent Switch */}
                  <Route path="/agent-switch"           component={AgentSwitch} />
                  <Route path="/workflows-agent-switch"> <Redirect to="/agent-switch" /> </Route>

                  {/* 404 */}
                  <Route component={NotFound} />
                </Switch>
              </DashboardLayout>
            </RequireTenant>
          </RequireAuth>
        </Route>
      </Switch>
    </Suspense>
  );
}
