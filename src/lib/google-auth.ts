type AuthSettings = {
  external?: {
    google?: boolean;
  };
};

export async function ensureGoogleAuthIsEnabled() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("A autenticação local ainda não está configurada.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
  });

  if (!response.ok) {
    throw new Error("Não foi possível verificar o login do Google agora.");
  }

  const settings = (await response.json()) as AuthSettings;
  if (!settings.external?.google) {
    throw new Error("O login com Google ainda não está ativado para este ambiente.");
  }
}
