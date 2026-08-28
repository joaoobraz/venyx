import { useEffect } from "react";

/**
 * Proteções básicas anti-cópia:
 * - Bloqueia menu de contexto (botão direito)
 * - Bloqueia atalhos comuns: F12, Ctrl/Cmd+S, Ctrl/Cmd+U, Ctrl+Shift+I/J/C
 * - Bloqueia drag de imagens/vídeos
 * - Desabilita seleção em mídia
 *
 * IMPORTANTE: isso é apenas dissuasão de usuários casuais.
 * Não substitui marca d'água + DRM/HLS-AES no servidor.
 */
export function ContentProtection() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Permite menu em campos de texto/edição (UX de copiar/colar)
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = (e.key ?? "").toLowerCase();
      // F12
      if (k === "f12") {
        e.preventDefault();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl/Cmd + S (salvar página), U (ver fonte), P (imprimir)
      if (mod && !e.shiftKey && (k === "s" || k === "u" || k === "p")) {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd + Shift + I / J / C (devtools)
      if (mod && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
        e.preventDefault();
        return;
      }
    };

    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "IMG" ||
          target.tagName === "VIDEO" ||
          target.tagName === "SOURCE")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("dragstart", onDragStart);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  return null;
}
