import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Types de notifications disponibles
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Catégories métier pour classifier les notifications
 */
export type NotificationCategory = 'prospect' | 'call' | 'invoice' | 'workflow' | 'system' | 'appointment';

/**
 * Interface d'une notification
 */
export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string; // URL optionnelle pour naviguer vers la page concernée
}

/**
 * Interface du store de notifications
 */
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
  getNotificationsByCategory: (category: NotificationCategory) => Notification[];
}

/**
 * Store Zustand pour la gestion centralisée des notifications
 * Persiste les notifications dans le localStorage pour les conserver entre les sessions
 */
export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      /**
       * Ajoute une nouvelle notification
       */
      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Limite à 50 notifications
          unreadCount: state.unreadCount + 1,
        }));
      },

      /**
       * Marque une notification comme lue
       */
      markAsRead: (id: any) => {
        set((state) => ({
          notifications: state.notifications.map((notif) =>
            notif.id === id ? { ...notif, read: true } : notif
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      /**
       * Marque toutes les notifications comme lues
       */
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notif) => ({ ...notif, read: true })),
          unreadCount: 0,
        }));
      },

      /**
       * Supprime une notification
       */
      deleteNotification: (id: any) => {
        set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          const wasUnread = notif && !notif.read;
          
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      },

      /**
       * Supprime toutes les notifications
       */
      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      /**
       * Retourne le nombre de notifications non lues
       */
      getUnreadCount: () => {
        return get().unreadCount;
      },

      /**
       * Filtre les notifications par catégorie
       */
      getNotificationsByCategory: (category) => {
        return get().notifications.filter((n) => n.category === category);
      },
    }),
    {
      name: 'servicall-notifications', // Clé dans le localStorage
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);

/**
 * Helper pour créer rapidement des notifications de succès
 */
export const notifySuccess = (title: string, message: string, category: NotificationCategory = 'system', actionUrl?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'success',
    category,
    title,
    message,
    actionUrl,
  });
};

/**
 * Helper pour créer rapidement des notifications d'erreur
 */
export const notifyError = (title: string, message: string, category: NotificationCategory = 'system', actionUrl?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'error',
    category,
    title,
    message,
    actionUrl,
  });
};

/**
 * Helper pour créer rapidement des notifications d'information
 */
export const notifyInfo = (title: string, message: string, category: NotificationCategory = 'system', actionUrl?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'info',
    category,
    title,
    message,
    actionUrl,
  });
};

/**
 * Helper pour créer rapidement des notifications d'avertissement
 */
export const notifyWarning = (title: string, message: string, category: NotificationCategory = 'system', actionUrl?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'warning',
    category,
    title,
    message,
    actionUrl,
  });
};
