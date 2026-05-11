import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AuthConfirmed() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired" | "already">("loading");

  useEffect(() => {
    // If we're already logged in properly, they are verified.
    if (user) {
      setStatus("success");
      return;
    }

    // Try to get hash params to see what happened.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get("error");
    const errorDescription = hashParams.get("error_description");

    if (error) {
      if (errorDescription?.toLowerCase().includes("expired")) {
        setStatus("expired");
      } else if (errorDescription?.toLowerCase().includes("already verified")) {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } else {
      // Supabase handles the session creation automatically if the hash contains access_token.
      // The AuthContext listener will catch it. If no error but no user yet, wait a bit.
      const timer = setTimeout(() => {
        if (!user) {
          // No user after 2 seconds, assume they need to log in or it failed.
          setStatus("error");
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, location]);

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-md text-center space-y-6 animate-scale-in">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
          <ShieldCheck className="h-7 w-7" />
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
            <p className="text-muted-foreground">Please wait a moment while we confirm your account.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto text-[#16A34A] grid h-16 w-16 place-items-center rounded-full bg-[#F0FDF4] mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">✅ Email verified successfully!</h1>
            <p className="text-muted-foreground">Your WelfareConnect account is now active. Welcome aboard!</p>
            <div className="pt-6">
              <Button onClick={() => navigate("/")} className="w-full">
                Go to Dashboard →
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Start by checking your eligibility for government schemes that match your profile.
            </p>
          </div>
        )}

        {status === "already" && (
          <div className="space-y-4">
            <div className="mx-auto text-primary grid h-16 w-16 place-items-center rounded-full bg-primary/10 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Already Verified</h1>
            <p className="text-muted-foreground">Your email is already verified.</p>
            <div className="pt-6">
              <Button onClick={() => navigate("/auth/citizen")} className="w-full">
                Log in
              </Button>
            </div>
          </div>
        )}

        {status === "expired" && (
          <div className="space-y-4">
            <div className="mx-auto text-amber-500 grid h-16 w-16 place-items-center rounded-full bg-amber-50 mb-4">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Link Expired</h1>
            <p className="text-muted-foreground">This verification link has expired.</p>
            <div className="pt-6 space-y-3">
              <Button onClick={() => navigate("/auth/citizen")} className="w-full">
                Go to Log In to resend
              </Button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="mx-auto text-destructive grid h-16 w-16 place-items-center rounded-full bg-destructive/10 mb-4">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Verification Failed</h1>
            <p className="text-muted-foreground">This link is invalid or something went wrong.</p>
            <div className="pt-6">
              <Button onClick={() => navigate("/auth/citizen")} className="w-full">
                Go to Log In
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
