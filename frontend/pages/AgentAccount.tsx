import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, KeyRound, User as UserIcon } from "lucide-react";

export default function AgentAccount() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
      }
    });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
      })
      .eq("id", user!.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated.");
  }

  async function handleChangePwd() {
    if (newPwd.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed.");
    setPwdOpen(false);
    setNewPwd("");
  }

  return (
    <div className="container py-10 animate-fade-in max-w-3xl">
      <header className="mb-8 flex items-center gap-3">
        <UserIcon className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold text-primary">Agent Account</h1>
      </header>

      <div className="space-y-6">
        <Card className="shadow-elegant">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-base">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="a-name">Name</Label>
                <Input id="a-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-phone">Phone Number</Label>
                <Input id="a-phone" inputMode="numeric" maxLength={10} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
              <Button type="submit" disabled={busy} className="sm:col-span-2 tap-target">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Details
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Security</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-wrap gap-3">
            <Button onClick={() => setPwdOpen(true)} variant="outline" className="tap-target">
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="np">New password</Label>
            <Input id="np" type="password" minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePwd} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
