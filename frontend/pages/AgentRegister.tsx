import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CheckCircle2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const agentSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  address: z.string().min(5, "Full address is required"),
  idType: z.string().min(1, "ID type is required"),
  idNumber: z.string().min(1, "ID number is required"),
  qualification: z.string().min(1, "Educational qualification is required"),
  experienceYears: z.coerce.number().min(0, "Experience must be 0 or more"),
  motivation: z.string().min(10, "Please provide a brief motivation").max(500, "Motivation too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AgentFormData = z.infer<typeof agentSchema>;

const LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada"];
const EXPERTISE = ["Agriculture", "Health", "Education", "Women Empowerment", "Disability", "Food Security", "Skill Development"];

export default function AgentRegister() {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [idProof, setIdProof] = useState<File | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
  });

  const onSubmit = async (data: AgentFormData) => {
    if (selectedLanguages.length === 0) {
      toast.error("Please select at least one language.");
      return;
    }
    if (selectedExpertise.length === 0) {
      toast.error("Please select at least one area of expertise.");
      return;
    }
    if (!idProof) {
      toast.error("Please upload your ID proof.");
      return;
    }

    setBusy(true);

    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("full_name", data.fullName);
    formData.append("phone", data.phone);
    formData.append("dob", data.dob);
    formData.append("gender", data.gender);
    formData.append("address", data.address);
    formData.append("id_type", data.idType);
    formData.append("id_number", data.idNumber);
    formData.append("qualification", data.qualification);
    formData.append("experience_years", data.experienceYears.toString());
    formData.append("motivation", data.motivation);
    formData.append("languages", JSON.stringify(selectedLanguages));
    formData.append("specialization", JSON.stringify(selectedExpertise));
    formData.append("id_proof", idProof);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-register`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      setSuccess(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="w-full max-w-lg shadow-elevated animate-scale-in border-primary/20">
          <CardContent className="pt-10 pb-8 text-center space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">Application submitted for review</h2>
            <p className="text-muted-foreground text-sm">
              Thank you for applying to become a WelfareConnect agent. Your application has been sent to our admin team for verification. You'll receive an email at <span className="font-semibold text-foreground">{watch("email")}</span> once your account is approved (usually within 24–48 hours).
            </p>
            <div className="rounded-lg bg-secondary/50 p-4 border border-border">
              <p className="text-sm font-medium text-foreground">
                You will not be able to log in until your application is approved.
              </p>
            </div>
            <div className="pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="w-full max-w-3xl shadow-elevated animate-scale-in">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Become an Agent</CardTitle>
          <CardDescription>
            Join WelfareConnect to help citizens access government schemes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input {...register("fullName")} />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input {...register("phone")} placeholder="+91" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" {...register("dob")} />
                  {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select onValueChange={(v) => setValue("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Full Address</Label>
                  <Textarea {...register("address")} placeholder="Street, City, State, Pincode" />
                  {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                </div>
              </div>
            </div>

            {/* Identity & Professional */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Identity & Professional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Government ID Type</Label>
                  <Select onValueChange={(v) => setValue("idType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                      <SelectItem value="PAN">PAN</SelectItem>
                      <SelectItem value="Voter ID">Voter ID</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.idType && <p className="text-xs text-destructive">{errors.idType.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>ID Number</Label>
                  <Input {...register("idNumber")} />
                  {errors.idNumber && <p className="text-xs text-destructive">{errors.idNumber.message}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Upload ID Proof (Image/PDF)</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="file" 
                      accept="image/*,.pdf" 
                      onChange={(e) => setIdProof(e.target.files?.[0] || null)}
                      className="cursor-pointer file:cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:py-1.5 file:px-4 file:mr-4 file:rounded-md hover:file:bg-primary/90"
                    />
                    {idProof && <span className="text-sm text-muted-foreground truncate w-48">{idProof.name}</span>}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Highest Educational Qualification</Label>
                  <Input {...register("qualification")} placeholder="e.g. B.A., M.S.W., etc." />
                  {errors.qualification && <p className="text-xs text-destructive">{errors.qualification.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>Years of Experience</Label>
                  <Input type="number" min="0" {...register("experienceYears")} />
                  {errors.experienceYears && <p className="text-xs text-destructive">{errors.experienceYears.message}</p>}
                </div>
              </div>
            </div>

            {/* Skills & Motivation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Skills & Motivation</h3>
              
              <div className="space-y-2">
                <Label>Languages Spoken (Multi-select)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  {LANGUAGES.map((lang) => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`lang-${lang}`}
                        checked={selectedLanguages.includes(lang)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedLanguages([...selectedLanguages, lang]);
                          else setSelectedLanguages(selectedLanguages.filter(l => l !== lang));
                        }}
                      />
                      <label htmlFor={`lang-${lang}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {lang}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label>Areas of Expertise (Multi-select)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                  {EXPERTISE.map((exp) => (
                    <div key={exp} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`exp-${exp}`}
                        checked={selectedExpertise.includes(exp)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedExpertise([...selectedExpertise, exp]);
                          else setSelectedExpertise(selectedExpertise.filter(e => e !== exp));
                        }}
                      />
                      <label htmlFor={`exp-${exp}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {exp}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label>Why do you want to be a WelfareConnect agent?</Label>
                <Textarea {...register("motivation")} className="h-24" placeholder="Briefly describe your motivation..." />
                {errors.motivation && <p className="text-xs text-destructive">{errors.motivation.message}</p>}
              </div>
            </div>

            {/* Account Security */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Account Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" {...register("confirmPassword")} />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy} size="lg">
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Submit Application"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/agent/login" className="text-accent hover:underline">Log in here</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
