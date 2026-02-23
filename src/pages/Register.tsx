import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Sparkles } from "lucide-react";
export default function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, company_name: companyName },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Check your email to confirm your account!");
    navigate("/login");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/80 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(234,89%,70%,0.3),transparent_60%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">ERP-AI</span>
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Započnite besplatno
            </h1>
            <p className="text-lg text-white/70 leading-relaxed">
              Kreirajte nalog i pokrenite vaš ERP sistem za nekoliko minuta. Bez ugovora, bez skrivenih troškova.
            </p>
          </div>
          <p className="text-sm text-white/40">© 2026 ERP-AI Platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <div className="absolute top-6 left-4 lg:hidden flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight">ERP-AI</span>
        </div>

        <Card className="w-full max-w-sm border-border/50 shadow-lg">
          <div className="p-6 pb-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t("register")}</h2>
            <p className="text-sm text-muted-foreground mt-1">Kreirajte vaš nalog</p>
          </div>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">{t("companyName")}</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("registering") : t("register")}
              </Button>
              <Link to="/login" className="text-sm text-primary hover:underline">{t("hasAccount")}</Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
