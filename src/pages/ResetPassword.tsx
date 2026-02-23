import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/LanguageToggle";
import erpAiLogo from "@/assets/erpAI.png";

export default function ResetPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for the reset link!");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[hsl(225,50%,12%)] via-[hsl(225,55%,18%)] to-[hsl(230,45%,10%)] relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[80px] animate-[pulse_6s_ease-in-out_infinite_1s]" />
        <div className="absolute top-[40%] left-[30%] w-[250px] h-[250px] rounded-full bg-[hsl(260,60%,30%)]/10 blur-[60px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full w-full">
          <div>
            <img src={erpAiLogo} alt="ERP-AI Logo" className="max-w-[180px]" />
          </div>

          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Resetujte lozinku
            </h1>
            <p className="text-base text-white/60 leading-relaxed">
              Unesite vaš email i poslaćemo vam link za resetovanje lozinke.
            </p>
          </div>

          <p className="text-xs text-white/30">© 2026 ERP-AI Platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <div className="absolute top-6 left-4 lg:hidden flex items-center gap-2">
          <img src={erpAiLogo} alt="ERP-AI" className="h-8" />
        </div>

        <Card className="w-full max-w-sm">
          <div className="p-5 pb-2 text-center">
            <h2 className="text-xl font-semibold tracking-tight">{t("resetPassword")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("forgotPassword")}</p>
          </div>
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("loading") : t("sendResetLink")}
              </Button>
              <Link to="/login" className="text-sm text-primary hover:underline">{t("backToLogin")}</Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
