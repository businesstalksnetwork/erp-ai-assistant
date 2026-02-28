import React, { useState, forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BarChart3, Users, Package, Factory, Brain } from "lucide-react";
import erpAiLogo from "@/assets/erpAI.png";

const Login = forwardRef<HTMLDivElement>(function Login(_props, ref) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
      navigate(isSuperAdmin ? "/super-admin/dashboard" : "/dashboard");
    }
    setLoading(false);
  };

  const features = [
    { icon: BarChart3, label: "Finansije i računovodstvo", desc: "Glavna knjiga, PDV, bilans" },
    { icon: Users, label: "CRM & Prodaja", desc: "Kontakti, ponude, fakture" },
    { icon: Package, label: "Skladište & WMS", desc: "Zalihe, prijem, otprema" },
    { icon: Factory, label: "Proizvodnja", desc: "Radni nalozi, BOM, planiranje" },
    { icon: Brain, label: "AI Asistent", desc: "Analitika, predikcije, uvidi" },
  ];

  return (
    <div ref={ref} className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[hsl(225,50%,12%)] via-[hsl(225,55%,18%)] to-[hsl(230,45%,10%)] relative overflow-hidden">
        {/* Animated orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[80px] animate-[pulse_6s_ease-in-out_infinite_1s]" />
        <div className="absolute top-[40%] left-[30%] w-[250px] h-[250px] rounded-full bg-[hsl(260,60%,30%)]/10 blur-[60px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full w-full">
          <div>
            <img src={erpAiLogo} alt="ERP-AI Logo" className="max-w-[180px]" />
          </div>

          <div className="space-y-6 max-w-md">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight leading-tight">
                Inteligentno upravljanje poslovanjem
              </h1>
              <p className="text-base text-white/60 leading-relaxed">
                Sveobuhvatni ERP sistem sa AI asistentom za srpsko tržište — sve na jednom mestu.
              </p>
            </div>

            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">{f.label}</p>
                    <p className="text-xs text-white/50">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30">© 2026 ERP-AI Platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>

        {/* Mobile brand header */}
        <div className="absolute top-6 left-4 lg:hidden flex items-center gap-2">
          <img src={erpAiLogo} alt="ERP-AI" className="h-8" />
        </div>

        <Card className="w-full max-w-sm">
          <div className="p-5 pb-2 text-center">
            <h2 className="text-xl font-semibold tracking-tight">{t("login")}</h2>
            <p className="text-sm text-muted-foreground mt-1">Prijavite se na vaš nalog</p>
          </div>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("loggingIn") : t("login")}
              </Button>
              <div className="flex justify-between w-full text-sm">
                <Link to="/reset-password" className="text-primary hover:underline">{t("forgotPassword")}</Link>
                <Link to="/register" className="text-primary hover:underline">{t("noAccount")}</Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
});

export default Login;
