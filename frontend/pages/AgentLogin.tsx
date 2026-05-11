/**
 * AgentLogin.tsx
 * ----------------------------------------------------------------------------
 * Route: /agent/login
 *
 * Dedicated sign-in screen for WelfareConnect agents. Uses the same Supabase
 * auth backend as user login but lives on its own URL so agents have a clear,
 * branded entry point. On success, agents land on /agent/dashboard.
 *
 * Key improvements over the original:
 *  - Role is verified AFTER the auth state updates (not immediately after
 *    signInWithPassword), so app_metadata is always available.
 *  - If a citizen accidentally uses this page, they're signed out with a
 *    clear error message.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function AgentLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Track whether we just submitted so we can do the role check on the
  // next auth state update (avoids acting on a pre-existing session).
  const pendingLoginRef = useRef(false);

  // Watch for auth state changes. When pendingLoginRef is true it means the
  // user just logged in via this form — now the session has settled with
  // app_metadata available, so we can safely check the role.
  useEffect(() => {
    if (!user) return;

    const role = (user.app_metadata as { role?: string } | undefined)?.role;
    const agentId = (user.app_metadata as { agent_id?: string } | undefined)?.agent_id;

    if (pendingLoginRef.current) {
      // New login — enforce agent-only access.
      pendingLoginRef.current = false;
      if (role !== "agent" || !agentId) {
        supabase.auth.signOut();
        toast.error(
          "This account is not registered as an agent. Please use the citizen login at /auth/citizen.",
        );
        return;
      }
      
      supabase.from("agents").select("is_approved").eq("id", agentId).single().then(({ data }) => {
        if (!data?.is_approved) {
          supabase.auth.signOut();
          toast.error("Your application is still under review. Please wait for admin approval.");
        } else {
          toast.success("Welcome back, Agent!");
          navigate("/agent/dashboard", { replace: true });
        }
      });
      return;
    }

    // Already signed in (page refresh) — redirect silently if correct role.
    if (role === "agent" && agentId) {
      supabase.from("agents").select("is_approved").eq("id", agentId).single().then(({ data }) => {
        if (data?.is_approved) {
          navigate("/agent/dashboard", { replace: true });
        } else {
          supabase.auth.signOut();
        }
      });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    pendingLoginRef.current = true;
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      pendingLoginRef.current = false;
      toast.error(error.message);
    }
    // On success the useEffect above will handle navigation after the
    // onAuthStateChange fires and populates app_metadata.
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-elevated animate-scale-in">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Agent Portal Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your assigned applications.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-email">Email</Label>
              <Input
                id="agent-email"
                type="email"
                autoComplete="email"
                required
                placeholder="agent@welfareconnect.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-password">Password</Label>
              <Input
                id="agent-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full tap-target" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
            <p className="pt-1 text-center text-xs text-muted-foreground">
              This portal is for authorised WelfareConnect agents only.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Not an agent?{" "}
              <Link to="/auth/citizen" className="text-accent hover:underline">
                <ArrowLeft className="mr-0.5 inline h-3 w-3" />
                Citizen login
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground mt-2 border-t pt-4">
              Want to become an agent?{" "}
              <Link to="/agent/register" className="text-accent hover:underline">
                Apply here
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
