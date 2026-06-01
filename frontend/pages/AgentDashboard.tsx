/**
 * AgentDashboard.tsx
 * ----------------------------------------------------------------------------
 * Route: /agent/dashboard  (role-gated to "agent")
 *
 * Two sections:
 *  1. PENDING POOL — all unassigned applications visible to every agent.
 *     The first agent to click "Accept" claims it (assigned_agent_id is set).
 *  2. MY APPLICATIONS — applications already assigned to this agent, with
 *     inline status-update and quick-detail accordion.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Users, Clock, FileSearch, CheckCircle2, AlertTriangle,
  ExternalLink, Inbox, UserCheck,
} from "lucide-react";

import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

/** Shape of a single row returned by the joined Supabase query below. */
interface AgentApplicationRow {
  id: string;
  status: string;
  consultation_status: string | null;
  consultation_date: string | null;
  consultation_time_slot: string | null;
  visit_requested: boolean | null;
  applied_at: string;
  support_expires_at: string | null;
  applied_via: string | null;
  scheme: { name: string; category: string | null } | null;
  applicant_name: string | null;
  applicant_phone: string | null;
  user_profile: { full_name: string | null; phone: string | null } | null;
  documents: { id: string; file_name: string; file_size_bytes: number }[];
}

interface PendingRow {
  id: string;
  status: string;
  applied_at: string;
  applied_via: string | null;
  scheme: { name: string; category: string | null } | null;
  applicant_name: string | null;
  applicant_phone: string | null;
  user_profile: { full_name: string | null } | null;
}

const STATUS_OPTIONS = ["Draft", "Submitted", "Under Review", "Approved", "Rejected"] as const;

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "Approved") return "default";
  if (s === "Rejected" || s === "Cancelled") return "destructive";
  if (s === "Under Review") return "secondary";
  return "outline";
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function planLabel(via: string | null): string {
  if (via === "saathi_plus_annual") return "Saathi Plus";
  if (via === "scheme_pack") return "Scheme Pack";
  return "—";
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const meta = (user?.app_metadata as { role?: string; agent_id?: string } | undefined) ?? {};
  const agentId = meta.agent_id;
  const isAgent = meta.role === "agent";

  // ── My assigned applications ──
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ["agent-applications", agentId],
    enabled: !!agentId && isAgent,
    staleTime: 20 * 1000,
    refetchInterval: 20 * 1000,
    queryFn: async (): Promise<AgentApplicationRow[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, consultation_status, consultation_date, consultation_time_slot,
          visit_requested, applied_at, support_expires_at, applied_via,
          scheme:schemes(name, category),
          user_profile:profiles!applications_user_id_fkey(full_name, phone),
          documents:application_documents(id, file_name, file_size_bytes)
        `)
        .eq("assigned_agent_id", agentId!)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentApplicationRow[];
    },
  });

  // ── Unassigned (pending pool) applications — all agents can see these ──
  const { data: pendingPool = [], isLoading: poolLoading } = useQuery({
    queryKey: ["pending-pool"],
    enabled: isAgent,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
    queryFn: async (): Promise<PendingRow[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, applied_at, consultation_status, applicant_name, applicant_phone,
          scheme:schemes(name),
          user_profile:profiles!applications_user_id_fkey(full_name, phone),
        `)
        .is("assigned_agent_id", null)
        .order("applied_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRow[];
    },
  });

  const stats = useMemo(() => ({
    total: applications.length,
    pendingConsultation: applications.filter((a) => a.consultation_status === "Pending").length,
    underReview: applications.filter((a) => a.status === "Under Review").length,
    approved: applications.filter((a) => a.status === "Approved").length,
  }), [applications]);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  /** Accept an application from the pending pool — claims it for this agent. */
  async function handleAccept(appId: string) {
    if (!agentId) return;
    setAcceptingId(appId);
    const { error } = await supabase
      .from("applications")
      .update({
        assigned_agent_id: agentId,
        agent_assigned_at: new Date().toISOString(),
        status: "Under Review",
      })
      .eq("id", appId)
      .is("assigned_agent_id", null); // optimistic-lock: only claim if still unassigned
    setAcceptingId(null);
    if (error) {
      toast.error("Could not accept — another agent may have claimed it. Refreshing.");
    } else {
      toast.success("Application accepted and assigned to you!");
    }
    // Refresh both lists
    queryClient.invalidateQueries({ queryKey: ["pending-pool"] });
    queryClient.invalidateQueries({ queryKey: ["agent-applications", agentId] });
  }

  async function handleStatusChange(appId: string, newStatus: string) {
    setUpdatingId(appId);
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", appId);
    setUpdatingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Status updated to "${newStatus}".`);
    queryClient.invalidateQueries({ queryKey: ["agent-applications", agentId] });
  }

  // Defensive: ProtectedRoute already enforces role, but agent_id may be missing
  // if the admin hasn't set it on the user yet. All hooks above run unconditionally.
  if (!isAgent) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="max-w-md text-muted-foreground">
          You are not authorised to view this page.
        </p>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container space-y-8 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </header>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 gap-4">
        <StatCard label="Total Assigned" value={stats.total} Icon={Users} />
        <StatCard label="Pending Consultation" value={stats.pendingConsultation} Icon={Clock} />
        <StatCard label="Under Review" value={stats.underReview} Icon={FileSearch} />
        <StatCard label="Approved" value={stats.approved} Icon={CheckCircle2} />
      </section>

      {/* ── PENDING POOL — unassigned applications ── */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Inbox className="h-5 w-5" />
            Pending Applications
            {pendingPool.length > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white">{pendingPool.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            New applications from citizens waiting to be accepted. First agent to accept claims it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {poolLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : pendingPool.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No unassigned applications at the moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Citizen</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPool.map((app) => (
                    <TableRow key={app.id} className="bg-amber-50/50 dark:bg-amber-950/5">
                      <TableCell className="font-medium">
                        {app.applicant_name ?? app.user_profile?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {app.scheme?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.scheme?.category ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {planLabel(app.applied_via)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/agent/application/${app.id}`}>
                            Open <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                          disabled={acceptingId === app.id}
                          onClick={() => handleAccept(app.id)}
                        >
                          {acceptingId === app.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <UserCheck className="h-3.5 w-3.5" />}
                          Accept
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MY ASSIGNED APPLICATIONS ── */}
      <Card>
        <CardHeader>
          <CardTitle>My Assigned Applications</CardTitle>
          <CardDescription>
            Update statuses inline or open an application for full details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load applications: {(error as Error).message}
            </p>
          ) : applications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No applications assigned to you yet. Accept one from the pending pool above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consultation</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead className="text-center">Visit</TableHead>
                    <TableHead className="text-center">Docs</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        {app.applicant_name ?? app.user_profile?.full_name ?? "—"}
                      </TableCell>
                      <TableCell>{app.applicant_phone ?? app.user_profile?.phone ?? "—"}</TableCell>
                      <TableCell>{app.scheme?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(app.status)}>{app.status}</Badge>
                      </TableCell>
                      <TableCell>{app.consultation_date ?? "—"}</TableCell>
                      <TableCell>{app.consultation_time_slot ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {app.visit_requested ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-center">{app.documents.length}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/agent/application/${app.id}`}>
                            Open <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {applications.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Quick details
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {applications.map((app) => (
                  <AccordionItem key={app.id} value={app.id}>
                    <AccordionTrigger className="text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {app.applicant_name ?? app.user_profile?.full_name ?? "Unknown user"}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">
                          {app.scheme?.name ?? "—"}
                        </span>
                        <Badge variant={statusVariant(app.status)} className="ml-2">
                          {app.status}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailBlock title="User">
                          <DetailRow k="Name" v={app.applicant_name ?? app.user_profile?.full_name ?? "—"} />
                          <DetailRow k="Phone" v={app.applicant_phone ?? app.user_profile?.phone ?? "—"} />
                        </DetailBlock>
                        <DetailBlock title="Scheme">
                          <DetailRow k="Name" v={app.scheme?.name ?? "—"} />
                          <DetailRow k="Category" v={app.scheme?.category ?? "—"} />
                          <DetailRow k="Plan" v={planLabel(app.applied_via)} />
                        </DetailBlock>
                        <DetailBlock title="Consultation">
                          <DetailRow k="Date" v={app.consultation_date ?? "—"} />
                          <DetailRow k="Slot" v={app.consultation_time_slot ?? "—"} />
                          <DetailRow k="Status" v={app.consultation_status ?? "—"} />
                        </DetailBlock>
                        <DetailBlock title="Documents">
                          {app.documents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {app.documents.map((d) => (
                                <li key={d.id} className="flex justify-between gap-2">
                                  <span className="truncate">{d.file_name}</span>
                                  <span className="shrink-0 text-muted-foreground">
                                    {formatBytes(d.file_size_bytes)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </DetailBlock>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                        <Label className="text-sm font-medium">Update status:</Label>
                        <Select
                          value={app.status}
                          onValueChange={(v) => handleStatusChange(app.id, v)}
                          disabled={updatingId === app.id}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {updatingId === app.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        <Button asChild size="sm" variant="ghost" className="ml-auto">
                          <Link to={`/agent/application/${app.id}`}>View full details →</Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, Icon,
}: { label: string; value: number; Icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
