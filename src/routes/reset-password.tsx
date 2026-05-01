import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const { t } = useI18n();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) console.error("[reset-password]", error);
    // Mensagem genérica em todos os casos para evitar enumeração de e-mails
    toast.success("Se este e-mail existir em nossa base, enviamos um link de redefinição.");
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha atualizada!");
      window.location.href = "/feed";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground">{t("auth.reset.title")}</h1>

        {recovery ? (
          <form onSubmit={updatePassword} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="np">{t("auth.reset.new")}</Label>
              <Input
                id="np"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {t("auth.reset.update")}
            </Button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="em">{t("auth.email")}</Label>
              <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {t("auth.reset.send")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
