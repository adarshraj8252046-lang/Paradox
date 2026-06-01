/**
 * AgentSchedule.tsx
 * ----------------------------------------------------------------------------
 * Route: /agent/schedule  (role-gated to "agent")
 *
 * Shows upcoming call and visit bookings for the signed-in agent, grouped
 * by date. Data comes from the interactions table (call_booked / visit_booked
 * rows with a future scheduled_at).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Loader2, Phone, Home as HomeIcon, ExternalLink } from "lucide-react";

interface ScheduleRow {
  id: string;
  interaction_type: string;
  scheduled_at: string;
  notes: string | null;
  completed_at: string | null;
  application: {
    id: string;
    scheme: { name: string } | null;
    applicant_name: string | null;
    user_profile: { full_name: string | null } | null;
  } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
}

function groupByDate(rows: ScheduleRow[]): Map<string, ScheduleRow[]> {
  const map = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const dateKey = new Date(row.scheduled_at).toDateString();
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(row);
  }
  return map;
}

export default function AgentSchedule() {
  const { user } = useAuth();
  const meta = (user?.app_metadata as { agent_id?: string } | undefined) ?? {};
  const agentId = meta.agent_id;

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["agent-schedule", agentId],
    enabled: !!agentId,
    staleTime: 60_000,
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data, error } = await supabase
        .from("interactions")
        .select(`
          id, interaction_type, scheduled_at, notes, completed_at,
          application:applications(
            id,
            applicant_name,
            scheme:schemes(name),
            user_profile:profiles!applications_user_id_fkey(full_name)
          )
        `)
        .eq("agent_id", agentId!)
        .in("interaction_type", ["call_booked", "visit_booked"])
        .is("completed_at", null)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScheduleRow[];
    },
  });

  const grouped = groupByDate(rows);

  return (
    <div className="container max-w-3xl space-y-6 py-10 animate-fade-in">
      <header className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Upcoming consultations and home visits
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-destructive py-8">
          Could not load schedule: {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">
              No upcoming appointments.
            </p>
            <p className="text-sm text-muted-foreground">
              Call and visit bookings will appear here once citizens schedule them.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([dateKey, dayRows]) => (
            <section key={dateKey}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {formatDate(dayRows[0].scheduled_at)}
              </h2>
              <div className="space-y-3">
                {dayRows.map((row) => {
                  const isCall = row.interaction_type === "call_booked";
                  const Icon = isCall ? Phone : HomeIcon;
                  return (
                    <Card key={row.id} className="transition-all hover:shadow-elegant">
                      <CardHeader className="pb-2 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`grid h-10 w-10 place-items-center rounded-lg ${isCall ? "bg-blue-500/10 text-blue-600" : "bg-green-500/10 text-green-600"}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {isCall ? "Consultation Call" : "Home Visit"}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(row.scheduled_at)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={isCall ? "secondary" : "outline"}>
                            {isCall ? "Call" : "Visit"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pb-4">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                          <span>
                            <span className="text-muted-foreground">Citizen: </span>
                            <span className="font-medium">
                              {row.application?.applicant_name ?? row.application?.user_profile?.full_name ?? "—"}
                            </span>
                          </span>
                          <span>
                            <span className="text-muted-foreground">Scheme: </span>
                            <span className="font-medium">
                              {row.application?.scheme?.name ?? "—"}
                            </span>
                          </span>
                        </div>
                        {row.notes && (
                          <p className="text-sm text-muted-foreground italic">"{row.notes}"</p>
                        )}
                        {row.application?.id && (
                          <Button asChild size="sm" variant="outline" className="mt-1">
                            <Link to={`/agent/application/${row.application.id}`}>
                              View Application <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
