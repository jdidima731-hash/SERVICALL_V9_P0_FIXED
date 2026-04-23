import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel,
} from "@/shared/ui/sidebar";
import {
  LayoutDashboard, Phone, Users, Workflow, Settings, MessageSquare,
  Brain, Target, BarChart3, Users2, FileText, ShoppingCart,
  Calendar, Megaphone, Globe, Shield, Award, Building2, Inbox,
  ClipboardList, TrendingUp, Zap
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function SidebarWidget() {
  const { t } = useTranslation("common");
  const [location, setLocation] = useLocation();

  const navGroups: NavGroup[] = [
    {
      title: "Principal",
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard", "Dashboard"),   path: "/dashboard" },
        { icon: Inbox,           label: t("nav.inbox", "Messagerie"),       path: "/inbox" },
        { icon: Calendar,        label: t("nav.calendar", "Calendrier"),    path: "/calendar" },
        { icon: ClipboardList,   label: t("nav.tasks", "Tâches"),           path: "/tasks" },
      ],
    },
    {
      title: "CRM",
      items: [
        { icon: Users,   label: t("nav.prospects", "Prospects"),  path: "/prospects" },
        { icon: Users2,  label: t("nav.clients", "Clients"),      path: "/clients" },
        { icon: Target,  label: t("nav.leads", "Leads"),          path: "/leads" },
      ],
    },
    {
      title: "Téléphonie",
      items: [
        { icon: Phone,         label: t("nav.calls", "Appels"),       path: "/calls" },
        { icon: Phone,         label: t("nav.softphone", "Softphone"), path: "/softphone" },
      ],
    },
    {
      title: "Campagnes",
      items: [
        { icon: Megaphone,  label: t("nav.campaigns", "Campagnes"),        path: "/campaigns" },
        { icon: Globe,      label: t("nav.social", "Réseaux Sociaux"),     path: "/social-media" },
        { icon: Target,     label: t("nav.leads_ext", "Extraction Leads"), path: "/lead-extraction" },
        { icon: MessageSquare, label: t("nav.messages", "Messages"),       path: "/messages" },
      ],
    },
    {
      title: "Workflows & IA",
      items: [
        { icon: Workflow,  label: t("nav.workflows", "Workflows"),         path: "/workflows" },
        { icon: Zap,       label: t("nav.agent_switch", "Agent Switch"),   path: "/agent-switch" },
        { icon: Brain,     label: t("nav.ai", "IA Monitoring"),            path: "/ia-monitoring" },
        { icon: Zap,       label: t("nav.intelligence", "Intelligence"),   path: "/intelligence" },
        { icon: Award,     label: t("nav.coaching", "Coaching"),           path: "/coaching" },
      ],
    },
    {
      title: "Recrutement",
      items: [
        { icon: Users2,       label: t("nav.recruitment", "Recrutement"),        path: "/recruitment" },
        { icon: Users2,       label: t("nav.recruitment_enhanced", "Recrutement+"), path: "/recruitment/enhanced" },
        { icon: Users2,       label: t("nav.interviews", "Entretiens"),          path: "/recruitment/interviews" },
        { icon: Award,        label: t("nav.training", "Formation"),              path: "/training" },
      ],
    },
    {
      title: "Finance",
      items: [
        { icon: ShoppingCart, label: t("nav.billing", "Facturation"),  path: "/billing" },
        { icon: FileText,     label: t("nav.invoices", "Factures"),    path: "/invoices" },
      ],
    },
    {
      title: "Administration",
      items: [
        { icon: Building2,    label: t("nav.team", "Équipe"),           path: "/team" },
        { icon: FileText,     label: t("nav.documents", "Documents"),   path: "/documents" },
        { icon: Shield,       label: t("nav.compliance", "Conformité"), path: "/compliance" },
        { icon: BarChart3,    label: t("nav.admin", "Admin"),           path: "/admin-dashboard" },
        { icon: Settings,     label: t("nav.settings", "Paramètres"),  path: "/settings" },
      ],
    },
  ];

  return (
    <Sidebar className="border-r border-slate-800 bg-slate-900">
      <SidebarHeader className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">Servicall V8</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 overflow-y-auto">
        {navGroups.map((group) => (
          <SidebarGroup key={group.title} className="mb-1">
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 mb-1">
              {group.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location === item.path || location.startsWith(item.path + "/")}
                    onClick={() => setLocation(item.path)}
                    className="text-slate-300 hover:text-white hover:bg-slate-800 data-[active=true]:bg-primary data-[active=true]:text-white rounded-lg text-sm"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
