import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreatorWatermark, type WatermarkPosition } from "@/components/CreatorWatermark";

export const Route = createFileRoute("/settings/profile")({
  component: SettingsProfile,
});

function SettingsProfile() {
  const { user, profile, refresh, loading } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio })
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil atualizado!");
      await refresh();
    }
  };

  if (!user || !profile) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-foreground">Editar perfil</h1>
        <form onSubmit={onSave} className="mt-6 space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={profile.username} disabled className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="dn">Nome de exibição</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
