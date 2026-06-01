/**
 * AgentAccount.tsx
 * Route: /agent/account (role-gated to "agent")
 *
 * Shows the agent's own profile from the `agents` table (not `profiles`).
 * Agents are not citizens; their data lives in public.agents.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, KeyRound, User as UserIcon, Mail, Phone, MapPin, Briefcase, Star } from "lucide-react";

interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  qualification: string | null;
  experience_years: number | null;
  motivation: string | null;
  specialization: string[] | null;
  is_active: boolean;
  is_approved: boolean;
}

export default function AgentAccount() {
  const { user } = useAuth();
  const meta = (user?.app_metadata as { agent_id?: string } | undefined) ?? {};
  const agentId = meta.agent_id;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    if (!agentId) { setLoading(false); return; }
    supabase
      .from("agents")
      .select("id, full_name, email, phone, address, qualification, experience_years, motivation, specialization, is_active, is_approved")
      .eq("id", agentId)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) { toast.error("Could not load agent profile: " + error.message); return; }
        if (data) {
          setAgent(data as AgentProfile);
          setFullName(data.full_name ?? "");
          setPhone((data as any).phone ?? "");
          setAddress((data as any).address ?? "");
        }
      });
  }, [agentId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    setBusy(true);
    const { error } = await supabase
      .from("agents")
      .update({ full_name: fullName, phone, address })
      .eq("id", agentId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated.");
      setAgent((prev) => prev ? { ...prev, full_name: fullName, phone, address } : prev);
    }
  }

  async function handleChangePwd() {
    if (newPwd.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setPwdBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed successfully.");
    setPwdOpen(false);
    setNewPwd("");
  }

  if (loading) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agentId || !agent) {
    return (
      <div className="container py-10 text-center text-muted-foreground">
        <UserIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <p>Agent profile not found. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="container py-10 animate-fade-in max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <UserIcon className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-primary">My Account</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {agent.is_approved && <Badge variant="default" className="bg-green-600">Approved</Badge>}
          {agent.is_active && <Badge variant="outline">Active</Badge>}
        </div>
      </header>

      {/* Read-only info card */}
      <Card>
        <CardHeader className="bg-primary/5 rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Agent Information
          </CardTitle>
          <CardDescription>Your registered details (contact admin to update qualification/specialization)</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <InfoRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email" value={agent.email ?? user?.email ?? "—"} />
          {agent.qualification && (
            <InfoRow icon={<Star className="h-4 w-4 text-muted-foreground" />} label="Qualification" value={agent.qualification} />
          )}
          {agent.experience_years !== null && (
            <InfoRow icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} label="Experience" value={`${agent.experience_years} year${agent.experience_years !== 1 ? "s" : ""}`} />
          )}
          {agent.specialization && agent.specialization.length > 0 && (
            <div className="flex items-start gap-2">
              <Star className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Specialization</p>
                <div className="flex flex-wrap gap-1">
                  {agent.specialization.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable details */}
      <Card>
        <CardHeader className="bg-primary/5 rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-name">Full Name</Label>
              <Input
                id="a-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-phone">Phone Number</Label>
              <Input
                id="a-phone"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="a-address">Address</Label>
              <Input
                id="a-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Your address"
              />
            </div>
            <Button type="submit" disabled={busy} className="sm:col-span-2">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Details
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="bg-primary/5 rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Button onClick={() => setPwdOpen(true)} variant="outline">
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Change password dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="np">New password (min 6 characters)</Label>
            <Input
              id="np"
              type="password"
              minLength={6}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="New password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePwd} disabled={pwdBusy}>
              {pwdBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex flex-1 items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}
