'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Check, FileText, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  // Fetch unread notifications
  const { data: notifications, refetch } = api.notifications.getUnread.useQuery();
  const unreadCount = notifications?.length || 0;

  // Mutations
  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const handleNotificationClick = (notification: { id: string; actionUrl: string | null }) => {
    markAsReadMutation.mutate({ notificationId: notification.id });
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'leave_reminder_20d':
      case 'leave_reminder_manager':
        return <Calendar className="h-4 w-4" />;
      case 'certificate_ready':
      case 'certificate_generated':
        return <FileText className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                className="h-8 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                Tout marquer lu
              </Button>
            )}
          </div>

          {/* List */}
          {notifications && notifications.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {notifications.map((notif: {
                id: string;
                type: string;
                title: string;
                message: string;
                actionUrl: string | null;
                read: boolean;
                createdAt: string
              }) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted",
                    notif.read && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-primary">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notif.createdAt), 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucune notification
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
