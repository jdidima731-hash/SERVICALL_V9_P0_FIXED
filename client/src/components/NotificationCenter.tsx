import { Bell, Check, CheckCheck, Trash2, X  } from 'lucide-react';
import { useNotificationStore, type NotificationCategory } from "@/lib/notificationStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";

/**
 * Icônes pour chaque catégorie de notification
 */
const categoryIcons: Record<NotificationCategory, React.ReactNode> = {
  prospect: "👤",
  call: "📞",
  invoice: "💳",
  workflow: "⚙️",
  system: "🔔",
  appointment: "📅",
};

/**
 * Couleurs pour chaque type de notification
 */
const typeColors = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  success: "bg-green-500/10 text-green-700 dark:text-green-400",
  warning: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  error: "bg-red-500/10 text-red-700 dark:text-red-400",
};

/**
 * Composant NotificationCenter
 * Affiche une icône Bell avec badge de comptage et un dropdown avec la liste des notifications
 */
export function NotificationCenter() {
  const { t } = useTranslation(['common']);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotificationStore();
  const [, setLocation] = useLocation();

  /**
   * Gère le clic sur une notification
   * Marque comme lue et navigue vers l'URL si présente
   */
  const handleNotificationClick = (notifId: string, actionUrl?: string) => {
    markAsRead(notifId);
    if (actionUrl) {
      setLocation(actionUrl);
    }
  };

  /**
   * Formate la date relative (ex: "il y a 5 minutes")
   */
  const formatRelativeTime = (date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
    } catch {
      return "À l'instant";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-accent"
          aria-label={`Notifications (${unreadCount} non lues)`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-xs"
                title={t('common:actions.mark_all_read', 'Tout marquer comme lu')}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs text-destructive hover:text-destructive"
                title={t('common:actions.delete_all', 'Supprimer toutes les notifications')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Liste des notifications */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Aucune notification</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Vous serez notifié des événements importants ici
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer group relative",
                    !notification.read && "bg-accent/30"
                  )}
                  onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                >
                  {/* Badge "non lu" */}
                  {!notification.read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                  )}

                  <div className="flex items-start gap-3 pl-3">
                    {/* Icône de catégorie */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg",
                        typeColors[notification.type]
                      )}
                    >
                      {categoryIcons[notification.category]}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          title="Supprimer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-muted-foreground/70">{formatRelativeTime(notification.timestamp)}</p>
                    </div>

                    {/* Bouton marquer comme lu */}
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        title="Marquer comme lu"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-4 py-2 text-center">
              <p className="text-xs text-muted-foreground">
                {notifications.length} notification{notifications.length > 1 ? "s" : ""} au total
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
