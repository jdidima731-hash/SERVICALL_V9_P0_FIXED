import { useAuth } from "@/_core/hooks/useAuth";
// import { useTenant } from "@/contexts/TenantContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LOGIN_PATH } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft } from 'lucide-react';
import { CSSProperties, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationCenter } from "./NotificationCenter";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Phone, Users as ProspectsIcon, Users, Calendar, Workflow, CreditCard, Settings as SettingsIcon, Brain, MessageSquare, Award, Shield, UserPlus, UserCheck, Briefcase, Sparkles, Share2  } from 'lucide-react';

const getMenuItems = (t: TFunction) => [
  { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard", roles: ["admin", "manager", "agent", "viewer"] },
  { icon: Brain, label: t("nav.ia_monitoring"), path: "/ia-monitoring", roles: ["admin", "manager", "agent"] },
  { icon: Phone, label: t("nav.calls"), path: "/calls", roles: ["admin", "manager", "agent"] },
  { icon: ProspectsIcon, label: t("nav.prospects"), path: "/prospects", roles: ["admin", "manager", "agent"] },
  { icon: Sparkles, label: t("nav.lead_extraction"), path: "/lead-extraction", roles: ["admin", "manager"] },
  { icon: Sparkles, label: t("nav.b2c_extraction"), path: "/b2c-extraction", roles: ["admin", "manager"] },
  { icon: Briefcase, label: t("nav.campaigns"), path: "/campaigns", roles: ["admin", "manager"] },
  { icon: MessageSquare, label: t("nav.messages"), path: "/messages", roles: ["admin", "manager", "agent"] },
  { icon: Calendar, label: t("nav.appointments"), path: "/appointments", roles: ["admin", "manager", "agent"] },
  { icon: Workflow, label: t("nav.workflows"), path: "/workflows", roles: ["admin", "manager"] },
  { icon: Award, label: t("nav.coaching"), path: "/coaching", roles: ["admin", "manager", "agent"] },
  { icon: Shield, label: t("nav.compliance"), path: "/compliance", roles: ["admin"] },
  { icon: CreditCard, label: t("nav.billing"), path: "/invoices", roles: ["admin", "manager", "agent"] },
  { icon: SettingsIcon, label: t("nav.settings"), path: "/settings", roles: ["admin"] },
  { icon: UserCheck, label: t("nav.recruitment"), path: "/recruitment", roles: ["admin", "manager"] },
  { icon: Sparkles, label: t("nav.intelligence_centrale"), path: "/intelligence-centrale", roles: ["admin", "manager"] },
  { icon: Share2, label: t("nav.social_manager"), path: "/social-manager", roles: ["admin", "manager"] },
  { icon: Users, label: "Team Manager", path: "/team-manager", roles: ["admin", "manager"] },
  { icon: MessageSquare, label: t("nav.inbox"), path: "/inbox", roles: ["admin", "manager", "agent"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  // const {_tenantId} = useTenant();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <DashboardLayoutAuthRequired />
    );
  }

  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutAuthRequired() {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            {t('actions.login_required')}
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {t('actions.login_required_desc')}
          </p>
        </div>
        <Button
          onClick={() => {
            window.location.href = LOGIN_PATH;
          }}
          size="lg"
          className="w-full shadow-lg hover:shadow-xl transition-all"
        >
          {t('nav.login')}
        </Button>
      </div>
    </div>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  // const {_tenantId} = useTenant();
  const { t } = useTranslation('common');
  const menuItems = getMenuItems(t);
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const activeMenuItem = menuItems.find((item: any) => item.path === location);
  const isMobile = useIsMobile();
  const badges = useSidebarBadges();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // La sidebar est fixed à gauche, donc on utilise directement e.clientX
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      {/* ✅ FIX: Le Sidebar est maintenant enfant direct du fragment, sans div.relative wrapper
          Le SidebarProvider a un wrapper flex, donc Sidebar et SidebarInset doivent être
          des enfants directs pour que le layout flex et les classes peer-data fonctionnent */}
      <Sidebar
        collapsible="icon"
        className="border-r-0"
        disableTransition={isResizing}
      >
        <SidebarHeader className="h-16 justify-center">
          <div className="flex items-center gap-3 px-2 transition-all w-full">
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              aria-label={t("nav.toggle_navigation")}
            >
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            {!isCollapsed ? (
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="font-semibold tracking-tight truncate">
                  {t("nav.title")}
                </span>
                <div className="flex items-center gap-1">
                  <NotificationCenter />
                  <LanguageSwitcher />
                </div>
              </div>
            ) : (
              <div className="flex justify-center w-full gap-1">
                <NotificationCenter />
                <LanguageSwitcher />
              </div>
            )}
          </div>
        </SidebarHeader>
        <div className="px-4 py-2">
          <div className="h-px bg-border/10 w-full" />
        </div>

        <SidebarContent className="gap-0">
          <SidebarMenu className="px-2 py-1">
            {menuItems
              .filter((item: any) => {
                if (!item.roles) return true;
                
                const role = (user as any)?.role || "agent";
                // owner = accès total (équivalent admin)
                if (role === "owner" || role === "superadmin") return true;
                return item.roles.includes(role);
              })
              .map((item: any) => {
              const isActive = location === item.path;
              // Récupérer le badge count pour cet item
              let badgeCount = 0;
              if (item.path === "/prospects") badgeCount = badges?.prospects ?? 0;
              else if (item.path === "/calls") badgeCount = badges?.calls ?? 0;
              else if (item.path === "/appointments") badgeCount = badges?.appointments ?? 0;
              else if (item.path === "/workflows") badgeCount = badges?.workflows ?? 0;
              
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`h-10 transition-all font-normal`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`}
                    />
                    <span className={cn("flex-1", isActive ? "font-bold" : "")}>{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge variant="default" className="ml-auto h-5 min-w-5 px-1 text-[10px] font-bold">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {(user as any)?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate leading-none">
                    {(user as any)?.name || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1.5">
                    {(user as any)?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t("actions.logout", "Se déconnecter")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>

        {/* ✅ FIX: Barre de redimensionnement en position fixed, alignée sur le bord droit de la sidebar */}
        {!isCollapsed && (
          <div
            className="fixed top-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
            style={{ left: `calc(var(--sidebar-width) - 2px)` }}
            onMouseDown={(e: any) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          />
        )}
      </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground font-semibold">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <NotificationCenter />
            </div>
          </div>
        )}
        <main className="flex-1 p-4" data-main-content>{children}</main>
      </SidebarInset>

      {/* ── Bottom Navigation Mobile ── */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          {[
            { path: "/dashboard", icon: "LayoutDashboard", label: t("nav.dashboard") },
            { path: "/prospects", icon: "Users", label: t("nav.prospects") },
            { path: "/calls", icon: "Phone", label: t("nav.calls") },
            { path: "/messages", icon: "MessageSquare", label: t("nav.messages") },
            { path: "/campaigns", icon: "Target", label: t("nav.campaigns") },
          ].map((item: any) => {
            const isActive = location === item.path;
            const IconMap: Record<string, React.ElementType> = {
              LayoutDashboard: LayoutDashboard,
              Users: ProspectsIcon,
              Phone: Phone,
              MessageSquare: MessageSquare,
              Target: Briefcase,
            };
            const Icon = IconMap[item.icon] ?? LayoutDashboard;
            return (
              <button
                key={item.path}
                className={`mobile-bottom-nav-item${isActive ? " active" : ""}`}
                onClick={() => setLocation(item.path)}
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}