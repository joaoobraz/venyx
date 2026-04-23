import { createFileRoute } from "@tanstack/react-router";
import { Bell, Heart, MessageCircle, DollarSign, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/notifications")({
  component: NotifPage,
});

const ITEMS = [
  { icon: UserPlus, text: "@aline começou a te seguir", time: "agora" },
  { icon: Heart, text: "@lara curtiu seu post", time: "5min" },
  { icon: DollarSign, text: "Você recebeu R$ 19,90 por uma compra PPV", time: "1h" },
  { icon: MessageCircle, text: "@bia te enviou uma mensagem", time: "2h" },
];

function NotifPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
          <Bell className="h-5 w-5 text-primary" /> Notificações
        </h1>
        <div className="overflow-hidden rounded-2xl bg-card">
          {ITEMS.map((it, i) => {
            const Icon = it.icon;
            return (
              <div key={i} className="flex items-center gap-3 border-b border-border p-4 last:border-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm text-foreground">{it.text}</div>
                <div className="text-xs text-muted-foreground">{it.time}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
