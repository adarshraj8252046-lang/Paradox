/**
 * AgentApplicationDetail.tsx — Sprint 7
 * Route: /agent/application/:id  (role-gated to "agent")
 *
 * Full detail view with: citizen info, entitlements, documents, status update
 * panel (with note), Log Call / Log Visit buttons, and audit timeline.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, FileText, Loader2, AlertTriangle, Clock,
  Download, Phone, Home as HomeIcon, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface AppDetail {
  id: string; user_id: string; status: string;
  consultation_status: string | null; consultation_date: string | null;
  consultation_time_slot: string | null; visit_requested: boolean | null;
  applied_at: string; support_expires_at: string | null;
  applied_via: string | null; message: string | null; aadhar: string | null;
  assigned_agent_id: string | null; agent_note: string | null;
  scheme: { id: string; name: string; category: string | null } | null;
  user_profile: { full_name: string | null; phone: string | null } | null;
  documents: { id: string; file_name: string; file_size_bytes: number; file_path: string }[];
  subscription: { calls_total: number; calls_used: number; visits_total: number; visits_used: number; expires_at: string; plan_type: string | null } | null;
  scheme_pack: { calls_total: number; calls_used: number; visits_total: number; visits_used: number; expires_at: string } | null;
}

interface AuditRow {
  id: string; previous_status: string | null; new_status: string;
  note: string | null; changed_at: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  "Submitted", "Under Review", "Documents Required",
  "Submitted to Govt Portal", "Approved", "Rejected",
] as const;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function maskAadhar(a: string | null) {
  if (!a) return "—";
  const d = a.replace(/\D/g, "");
  return d.length < 4 ? "—" : `XXXXXXXX${d.slice(-4)}`;
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function planLabel(v: string | null) {
  if (v === "saathi_plus_annual") return "Saathi Plus (₹999/yr)";
  if (v === "scheme_pack") return "Scheme Pack (₹199)";
  return "—";
}
function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "Approved") return "default";
  if (s === "Rejected") return "destructive";
  if (s === "Under Review" || s === "Submitted to Govt Portal") return "secondary";
  return "outline";
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function AgentApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const meta = (user?.app_metadata as { role?: string; agent_id?: string } | undefined) ?? {};
  const agentId = meta.agent_id;

  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [logging, setLogging] = useState<"call" | "visit" | null>(null);

  /* Application query */
  const { data: app, isLoading, error } = useQuery({
    queryKey: ["agent-application", id],
    enabled: !!id && !!agentId,
    queryFn: async (): Promise<AppDetail | null> => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, user_id, status, consultation_status, consultation_date,
          consultation_time_slot, visit_requested, applied_at, support_expires_at,
          applied_via, message, aadhar, assigned_agent_id, agent_note,
          scheme:schemes(id, name, category),
          user_profile:profiles!applications_user_id_fkey(full_name, phone),
          documents:application_documents(id, file_name, file_size_bytes, file_path)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Fetch entitlements depending on plan type
      let subscription = null;
      let scheme_pack = null;
      if ((data as any).applied_via === "saathi_plus_annual") {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("calls_total, calls_used, visits_total, visits_used, expires_at, plan_type")
          .eq("user_id", (data as any).user_id)
          .maybeSingle();
        subscription = sub;
      } else {
        const { data: pack } = await supabase
          .from("scheme_packs")
          .select("calls_total, calls_used, visits_total, visits_used, expires_at")
          .eq("user_id", (data as any).user_id)
          .eq("scheme_id", (data as any).scheme?.id ?? "")
          .eq("is_active", true)
          .maybeSingle();
        scheme_pack = pack;
      }

      return { ...(data as any), subscription, scheme_pack } as AppDetail;
    },
  });

  /* Audit log query */
  const { data: audit = [] } = useQuery({
    queryKey: ["audit-log", id],
    enabled: !!id && !!app,
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("application_status_audit")
        .select("id, previous_status, new_status, note, changed_at")
        .eq("application_id", id!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  /* ── Status Update ─────────────────────────────────────────────────── */
  async function handleStatusUpdate() {
    if (!newStatus || !app) return;
    setUpdating(true);
    const prev = app.status;

    // 1. Update application status + note
    const { error: e1 } = await supabase
      .from("applications")
      .update({ status: newStatus, agent_note: note || null, status_updated_at: new Date().toISOString() })
      .eq("id", app.id);
    if (e1) { toast.error(e1.message); setUpdating(false); return; }

    // 2. Write audit row
    await supabase.from("application_status_audit").insert({
      application_id: app.id,
      agent_id: agentId,
      previous_status: prev,
      new_status: newStatus,
      note: note || null,
    });

    // 3. Notify citizen
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: `Application status updated: ${newStatus}`,
      body: note
        ? `Your application for ${app.scheme?.name ?? "your scheme"} was updated. Agent note: ${note}`
        : `Your application for ${app.scheme?.name ?? "your scheme"} is now "${newStatus}".`,
      target_role: "citizen",
      application_id: app.id,
    });

    toast.success(`Status updated to "${newStatus}"`);
    setNote(""); setNewStatus("");
    qc.invalidateQueries({ queryKey: ["agent-application", id] });
    qc.invalidateQueries({ queryKey: ["audit-log", id] });
    setUpdating(false);
  }

  /* ── Log Call / Visit ──────────────────────────────────────────────── */
  async function handleLog(type: "call" | "visit") {
    if (!app) return;
    setLogging(type);

    const entitlement = app.applied_via === "saathi_plus_annual" ? app.subscription : app.scheme_pack;
    const usedField = type === "call" ? "calls_used" : "visits_used";
    const totalField = type === "call" ? "calls_total" : "visits_total";
    const used = entitlement?.[usedField] ?? 0;
    const total = entitlement?.[totalField] ?? 0;

    if (used >= total) {
      toast.error(`No ${type === "call" ? "calls" : "visits"} remaining.`);
      setLogging(null); return;
    }

    // Insert interaction
    await supabase.from("interactions").insert({
      application_id: app.id,
      agent_id: agentId,
      interaction_type: type === "call" ? "call_completed" : "visit_completed",
      completed_at: new Date().toISOString(),
      notes: `${type === "call" ? "Call" : "Home visit"} logged by agent`,
      created_by: "agent",
    });

    // Decrement entitlement
    if (app.applied_via === "saathi_plus_annual") {
      await supabase
        .from("subscriptions")
        .update({ [usedField]: used + 1 })
        .eq("user_id", app.user_id);
    } else {
      await supabase
        .from("scheme_packs")
        .update({ [usedField]: used + 1 })
        .eq("user_id", app.user_id)
        .eq("scheme_id", app.scheme?.id ?? "");
    }

    toast.success(`${type === "call" ? "Call" : "Visit"} logged successfully.`);
    qc.invalidateQueries({ queryKey: ["agent-application", id] });
    setLogging(null);
  }

  /* ── Guards ─────────────────────────────────────────────────────────── */
  if (isLoading) return <Spinner />;
  if (error) return <Err msg={(error as Error).message} />;
  if (!app) return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="text-2xl font-bold">Application not found</h1>
      <Button variant="outline" onClick={() => navigate("/agent/dashboard")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
    </div>
  );

  const entitlement = app.applied_via === "saathi_plus_annual" ? app.subscription : app.scheme_pack;
  const callsLeft = (entitlement?.calls_total ?? 0) - (entitlement?.calls_used ?? 0);
  const visitsLeft = (entitlement?.visits_total ?? 0) - (entitlement?.visits_used ?? 0);

  return (
    <div className="container max-w-4xl space-y-6 py-8 animate-fade-in">
      <Button asChild variant="ghost" size="sm">
        <Link to="/agent/applications">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Applications
        </Link>
      </Button>

      {/* ── Header card ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{app.user_profile?.full_name ?? "Unnamed"}</CardTitle>
              <CardDescription>
                {app.scheme?.name ?? "Unknown scheme"} · Applied{" "}
                {new Date(app.applied_at).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge variant={statusVariant(app.status)} className="text-sm">{app.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Citizen info */}
          <Section title="Citizen Information">
            <Row k="Full Name" v={app.user_profile?.full_name ?? "—"} />
            <Row k="Phone" v={app.user_profile?.phone ?? "—"} />
            <Row k="Aadhar" v={maskAadhar(app.aadhar)} />
            {app.message && <Row k="Message" v={app.message} multiline />}
          </Section>
          <Separator />

          {/* Plan & Entitlements */}
          <Section title="Subscription & Entitlements">
            <Row k="Plan" v={planLabel(app.applied_via)} />
            <Row k="Calls Remaining" v={`${callsLeft} of ${entitlement?.calls_total ?? 0}`} />
            <Row k="Visits Remaining" v={`${visitsLeft} of ${entitlement?.visits_total ?? 0}`} />
            {entitlement?.expires_at && (
              <Row k="Expires" v={new Date(entitlement.expires_at).toLocaleDateString()} />
            )}
          </Section>
          <Separator />

          {/* Log call/visit buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm" variant="outline"
              disabled={!!logging || callsLeft <= 0}
              onClick={() => handleLog("call")}
              className="gap-2"
            >
              {logging === "call" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Log Call {callsLeft > 0 && `(${callsLeft} left)`}
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={!!logging || visitsLeft <= 0}
              onClick={() => handleLog("visit")}
              className="gap-2"
            >
              {logging === "visit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HomeIcon className="h-4 w-4" />}
              Log Visit {visitsLeft > 0 && `(${visitsLeft} left)`}
            </Button>
          </div>
          <Separator />

          {/* Scheme & Consultation */}
          <Section title="Scheme & Consultation">
            <Row k="Scheme" v={app.scheme?.name ?? "—"} />
            <Row k="Category" v={app.scheme?.category ?? "—"} />
            <Row k="Consultation Date" v={app.consultation_date ?? "—"} />
            <Row k="Slot" v={app.consultation_time_slot ?? "—"} />
            <Row k="Consultation Status" v={app.consultation_status ?? "—"} />
            <Row k="Visit Requested" v={app.visit_requested ? "Yes" : "No"} />
          </Section>
          <Separator />

          {/* Documents */}
          <Section title="Documents">
            {app.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2">
                {app.documents.map((d) => <DocumentRow key={d.id} doc={d} />)}
              </ul>
            )}
          </Section>
        </CardContent>
      </Card>

      {/* ── Status Update Panel ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update Application Status</CardTitle>
          <CardDescription>Add an optional note visible to the citizen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-select">New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status-select" className="w-[260px]">
                <SelectValue placeholder={`Current: ${app.status}`} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-note">Note for citizen (optional)</Label>
            <Textarea
              id="agent-note"
              placeholder="e.g. Your income certificate is missing. Please upload it."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleStatusUpdate}
            disabled={updating || !newStatus}
            className="gap-2"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Update Status
          </Button>
          {app.agent_note && (
            <p className="mt-2 rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Last note: </span>{app.agent_note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Audit Timeline ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" /> Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {audit.map((a) => (
                <li key={a.id} className="border-l-2 border-primary/40 pl-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {a.previous_status
                        ? `${a.previous_status} → ${a.new_status}`
                        : a.new_status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.changed_at).toLocaleString()}
                    </p>
                  </div>
                  {a.note && <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Small Helpers ─────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
function Err({ msg }: { msg: string }) {
  return <div className="container py-10"><p className="text-destructive">{msg}</p></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
function Row({ k, v, multiline }: { k: string; v: string; multiline?: boolean }) {
  return (
    <div className={multiline ? "space-y-1" : "flex flex-wrap items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0"}>
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className={multiline ? "block text-sm" : "text-sm font-medium"}>{v}</span>
    </div>
  );
}
function DocumentRow({ doc }: { doc: { id: string; file_name: string; file_size_bytes: number; file_path: string } }) {
  const [busy, setBusy] = useState(false);
  async function dl() {
    setBusy(true);
    const { data, error } = await supabase.storage.from("application-docs").createSignedUrl(doc.file_path, 3600);
    setBusy(false);
    if (error || !data?.signedUrl) { toast.error("Could not generate download link"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-medium">{doc.file_name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted-foreground">{fmtBytes(doc.file_size_bytes)}</span>
        <Button size="sm" variant="outline" onClick={dl} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          <span className="ml-1.5 hidden sm:inline">Download</span>
        </Button>
      </div>
    </li>
  );
}
