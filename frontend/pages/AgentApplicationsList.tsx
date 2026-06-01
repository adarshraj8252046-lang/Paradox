/**
 * AgentApplicationsList.tsx
 * ----------------------------------------------------------------------------
 * Route: /agent/applications  (role-gated to "agent")
 *
 * Two tabs:
 *   1. Pending Pool — unassigned applications all agents can accept.
 *   2. My Applications — applications assigned to this agent.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Search, FolderOpen, ExternalLink, SlidersHorizontal,
  Inbox, UserCheck,
} from "lucide-react";
import { toast } from "sonner";

interface AppRow {
  id: string;
  status: string;
  applied_at: string;
  applied_via: string | null;
  scheme: { name: string } | null;
  applicant_name: string | null;
  applicant_phone: string | null;
  user_profile: { full_name: string | null } | null;
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

const ALL = "all";

const STATUS_OPTIONS = [
  "Submitted", "Under Review", "Documents Required",
  "Submitted to Govt Portal", "Approved", "Rejected", "Cancelled",
];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "Approved") return "default";
  if (s === "Rejected" || s === "Cancelled") return "destructive";
  if (s === "Under Review" || s === "Submitted to Govt Portal") return "secondary";
  return "outline";
}

function planLabel(v: string | null) {
  if (v === "saathi_plus_annual") return "Saathi Plus";
  if (v === "scheme_pack") return "Pack ₹199";
  return "—";
}

function planVariant(v: string | null): "default" | "outline" {
  return v === "saathi_plus_annual" ? "default" : "outline";
}

export default function AgentApplicationsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meta = (user?.app_metadata as { agent_id?: string } | undefined) ?? {};
  const agentId = meta.agent_id;

  const [activeTab, setActiveTab] = useState<"pending" | "mine">("pending");

  // ── Pending pool (unassigned) ──
  const { data: pendingPool = [], isLoading: poolLoading } = useQuery({
    queryKey: ["pending-pool-list"],
    enabled: true,
    staleTime: 10_000,
    refetchInterval: 10_000,
    queryFn: async (): Promise<PendingRow[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, applied_at, applicant_name, applicant_phone,
          scheme:schemes(name, category),
          user_profile:profiles!applications_user_id_fkey(full_name)
        `)
        .is("assigned_agent_id", null)
        .order("applied_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRow[];
    },
  });

  // ── My assigned applications ──
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ["agent-applications-list", agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async (): Promise<AppRow[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, applied_at, applied_via, applicant_name, applicant_phone,
          scheme:schemes(name),
          user_profile:profiles!applications_user_id_fkey(full_name)
        `)
        .eq("assigned_agent_id", agentId!)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AppRow[];
    },
  });

  // ---------- filter & search state ----------
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(ALL);
  const [filterPlan, setFilterPlan] = useState(ALL);

  const schemeNames = useMemo(
    () => Array.from(new Set(applications.map((a) => a.scheme?.name ?? "Unknown"))),
    [applications],
  );
  const [filterScheme, setFilterScheme] = useState(ALL);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return applications.filter((a) => {
      if (filterStatus !== ALL && a.status !== filterStatus) return false;
      if (filterPlan !== ALL && a.applied_via !== filterPlan) return false;
      if (filterScheme !== ALL && (a.scheme?.name ?? "Unknown") !== filterScheme) return false;
      if (q) {
        const name = (a.applicant_name ?? a.user_profile?.full_name ?? "").toLowerCase();
        if (!name.includes(q) && !a.id.includes(q)) return false;
      }
      return true;
    });
  }, [applications, search, filterStatus, filterPlan, filterScheme]);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);

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
      .is("assigned_agent_id", null);
    setAcceptingId(null);
    if (error) {
      toast.error("Could not accept — another agent may have claimed it.");
    } else {
      toast.success("Application accepted!");
    }
    qc.invalidateQueries({ queryKey: ["pending-pool-list"] });
    qc.invalidateQueries({ queryKey: ["agent-applications-list", agentId] });
  }

  return (
    <div className="container space-y-6 py-10 animate-fade-in">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <FolderOpen className="h-7 w-7 text-primary" />
          Applications
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse the pending pool or view your assigned applications.
        </p>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("pending")}
        >
          <span className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Pending Pool
            {pendingPool.length > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                {pendingPool.length}
              </Badge>
            )}
          </span>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "mine"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("mine")}
        >
          My Applications
        </button>
      </div>

      {/* ── PENDING POOL TAB ── */}
      {activeTab === "pending" && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-300">New Applications</CardTitle>
            <CardDescription>
              Accept an application to claim it. It will disappear from other agents' view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {poolLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
              </div>
            ) : pendingPool.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">No pending applications</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  New applications from citizens will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Citizen</TableHead>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPool.map((app) => (
                      <TableRow key={app.id} className="bg-amber-50/50 dark:bg-amber-950/10">
                        <TableCell className="font-medium">
                          {app.applicant_name ?? app.user_profile?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {app.scheme?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(app.scheme as any)?.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={planVariant(app.applied_via)} className="text-xs">
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
      )}

      {/* ── MY APPLICATIONS TAB ── */}
      {activeTab === "mine" && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-5">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or application ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  id="apps-search"
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[170px]" id="filter-status">
                  <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-[155px]" id="filter-plan">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All plans</SelectItem>
                  <SelectItem value="saathi_plus_annual">Saathi Plus</SelectItem>
                  <SelectItem value="scheme_pack">Pack ₹199</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterScheme} onValueChange={setFilterScheme}>
                <SelectTrigger className="w-[170px]" id="filter-scheme">
                  <SelectValue placeholder="Scheme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All schemes</SelectItem>
                  {schemeNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>

              {(filterStatus !== ALL || filterPlan !== ALL || filterScheme !== ALL || search) && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setSearch(""); setFilterStatus(ALL); setFilterPlan(ALL); setFilterScheme(ALL); }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isLoading ? "Loading…" : `${filtered.length} application${filtered.length !== 1 ? "s" : ""}`}
              </CardTitle>
              <CardDescription>
                {filterStatus !== ALL || search ? "Filtered results" : "All assigned applications"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : error ? (
                <p className="py-8 text-center text-sm text-destructive">
                  Could not load applications: {(error as Error).message}
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-lg font-medium text-muted-foreground">
                    {applications.length === 0
                      ? "No applications assigned to you yet."
                      : "No applications match your filters."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Citizen</TableHead>
                        <TableHead>Scheme</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((app) => (
                        <TableRow key={app.id} className="hover:bg-secondary/30">
                          <TableCell className="font-medium">
                            {app.applicant_name ?? app.user_profile?.full_name ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {app.scheme?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={planVariant(app.applied_via)} className="text-xs">
                              {planLabel(app.applied_via)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(app.applied_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(app.status)}>{app.status}</Badge>
                          </TableCell>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
