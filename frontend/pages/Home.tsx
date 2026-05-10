/**
 * Home.tsx
 * ----------------------------------------------------------------------------
 * Landing page (route "/").
 *
 * Layout:
 *   • Hero with the headline "Find Government Schemes You Deserve" and two
 *     CTAs (Check Eligibility → /eligibility, Explore Schemes → /schemes).
 *   • Three feature cards: Smart Matching, NGO Verification, Trust & Safety.
 *
 * Sets the H1 + meta description for SEO.
 */
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, BadgeCheck, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  // Set the document title and meta description for SEO. <60 / <160 chars.
  useEffect(() => {
    document.title = "WelfareConnect — Find Government Schemes You Deserve";
    const meta = document.querySelector('meta[name="description"]') ||
      Object.assign(document.createElement("meta"), { name: "description" });
    meta.setAttribute("content", "Discover Indian welfare schemes you qualify for and connect with verified NGOs in Kolkata for direct help.");
    document.head.appendChild(meta);
  }, []);

  const features = [
    { icon: Sparkles,    titleKey: "home.feature1.title", bodyKey: "home.feature1.body" },
    { icon: ShieldCheck, titleKey: "home.feature2.title", bodyKey: "home.feature2.body" },
    { icon: BadgeCheck,  titleKey: "home.feature3.title", bodyKey: "home.feature3.body" },
  ];

  return (
    <div className="animate-fade-in">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden pt-24 pb-32">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px] animate-pulse-slow" aria-hidden="true" />
        <div className="absolute top-0 right-0 -z-10 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/4 rounded-full bg-accent/20 blur-[100px] animate-pulse-slow" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-primary/10 blur-[100px]" aria-hidden="true" />
        
        <div className="container relative z-10 text-center animate-slide-up">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/50 px-4 py-1.5 text-sm font-semibold text-primary backdrop-blur-md shadow-sm">
                <ShieldCheck className="h-4 w-4" /> Verified · Trusted · Free
              </span>
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-pulse-slow">
              {t("home.heading")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-muted-foreground sm:text-xl">
              {t("home.subcopy")}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="tap-target h-14 w-full rounded-full px-8 text-base font-semibold shadow-glow sm:w-auto hover:scale-105 transition-transform duration-300">
                <Link to="/eligibility">
                  {t("home.cta.eligibility")} <ArrowRight className="ml-2 h-5 w-5 animate-bounce" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tap-target h-14 w-full rounded-full border-2 bg-background/50 px-8 text-base font-semibold backdrop-blur-md sm:w-auto hover:bg-secondary/80 transition-colors">
                <Link to="/schemes">{t("home.cta.schemes")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Feature cards ---------- */}
      <section className="container relative z-10 -mt-12 grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <Card key={f.titleKey} className={`group glass-card overflow-hidden border-border/40 hover:border-primary/50 ${i === 1 ? 'lg:-translate-y-4 lg:hover:-translate-y-6' : ''}`}>
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-xl font-bold tracking-tight">{t(f.titleKey)}</h3>
                <p className="text-base leading-relaxed text-muted-foreground">{t(f.bodyKey)}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
