/**
 * AgentNotifications.tsx
 * ----------------------------------------------------------------------------
 * Route: /agent/notifications  (role-gated to "agent")
 *
 * Lists notifications targeted at the signed-in agent. Clicking a notification
 * marks it as read and deep-links to the relevant application detail page.
 * Unread count is kept in sync via Supabase Realtime.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentNotif {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  application_id: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} day${Math.floor(hr / 24) === 1 ? "" : "s"} ago`;
}

export default function AgentNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agent-notifications", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at, application_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AgentNotif[];
    },
  });

  // Real-time: refresh list when a new notification arrives
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`agent-notifs-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["agent-notifications", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  async function handleClick(n: AgentNotif) {
    if (!n.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["agent-notifications", user?.id] });
    }
    if (n.application_id) {
      navigate(`/agent/application/${n.application_id}`);
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="container max-w-2xl space-y-6 py-10 animate-fade-in">
      <header className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="ml-1">
            {unreadCount} unread
          </Badge>
        )}
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">No notifications yet.</p>
            <p className="text-sm text-muted-foreground">
              You'll be notified here when citizens submit new applications.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={cn(
              "block w-full rounded-lg border border-border bg-card p-4 text-left transition-all hover:shadow-elegant",
              !n.is_read && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {!n.is_read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.body}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <time className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</time>
                {n.application_id && (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    View <ExternalLink className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
