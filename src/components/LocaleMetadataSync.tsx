import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * Grava o idioma da interface nos metadados da conta (user_metadata.locale)
 * para os e-mails do Supabase (confirmação, redefinição, código 2FA) saírem
 * no idioma da pessoa — o template usa {{ if eq .Data.locale "en" }}.
 * Só escreve quando muda, para não gerar chamadas à toa.
 */
export function LocaleMetadataSync() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const current = (user.user_metadata as { locale?: string } | undefined)?.locale;
    if (current === locale || lastSynced.current === `${user.id}:${locale}`) return;
    lastSynced.current = `${user.id}:${locale}`;
    supabase.auth
      .updateUser({ data: { locale } })
      .then(({ error }) => {
        if (error) lastSynced.current = null;
      })
      .catch(() => {
        lastSynced.current = null;
      });
  }, [user, locale]);

  return null;
}
