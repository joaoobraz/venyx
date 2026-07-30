import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  UserCog,
  Loader2,
  Plus,
  X,
  Shield,
  Crown,
  Store,
  Users as UsersIcon,
  Star,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireAdminServer } from "@/_server/admin.functions";
import {
  listUsersAdmin,
  updateUserRoleAdmin,
} from "@/_server/admin-users.functions";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/users" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({
    meta: [{ title: "Usuários — Admin" }],
  }),
  component: AdminUsersPage,
});

type Role = "subscriber" | "creator" | "admin" | "ambassador" | "seller";

const ALL_ROLES: { value: Role; label: string; icon: typeof Shield; color: string }[] = [
  { value: "subscriber", label: "Subscriber", icon: UsersIcon, color: "bg-muted text-muted-foreground" },
  { value: "creator", label: "Creator", icon: Crown, color: "bg-primary/15 text-primary" },
  { value: "seller", label: "Seller", icon: Store, color: "bg-emerald-500/15 text-emerald-600" },
  { value: "ambassador", label: "Embaixadora", icon: Star, color: "bg-amber-500/15 text-amber-600" },
  { value: "admin", label: "Admin", icon: Shield, color: "bg-destructive/15 text-destructive" },
];

type UserRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: Role[];
};

function AdminUsersPage() {
  const list = useServerFn(listUsersAdmin);
  const update = useServerFn(updateUserRoleAdmin);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await list({
        data: {
          search: search.trim() || undefined,
          roleFilter: roleFilter === "all" ? undefined : roleFilter,
          limit: 100,
        },
      });
      setUsers(res.users as UserRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleToggleRole = async (
    userId: string,
    role: Role,
    hasRole: boolean,
  ) => {
    const key = `${userId}:${role}`;
    setBusyKey(key);
    try {
      await update({
        data: {
          targetUserId: userId,
          role,
          action: hasRole ? "remove" : "add",
        },
      });
      // optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? {
                ...u,
                roles: hasRole
                  ? u.roles.filter((r) => r !== role)
                  : [...u.roles, role],
              }
            : u,
        ),
      );
      toast.success(
        hasRole ? `Cargo ${role} removido` : `Cargo ${role} atribuído`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar cargo");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" />
            Usuários & Cargos
          </h1>
          <p className="text-muted-foreground mt-1">
            Atribua ou remova cargos como Seller, Creator, Admin, Embaixadora.
          </p>
        </div>

        <Card className="p-4">
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs font-medium text-muted-foreground">
                Buscar por @username ou nome
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="ex: maria"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") load();
                  }}
                />
              </div>
            </div>
            <div className="w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">
                Filtrar por cargo
              </label>
              <Select
                value={roleFilter}
                onValueChange={(v) => setRoleFilter(v as Role | "all")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Buscar
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {loading && users.length === 0 && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && users.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhum usuário encontrado.
            </Card>
          )}

          {users.map((u) => (
            <Card key={u.user_id} className="p-4">
              <div className="flex items-start gap-4 flex-wrap">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {u.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">
                    {u.display_name ?? u.username}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{u.username}
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Sem cargos
                      </span>
                    )}
                    {u.roles.map((r) => {
                      const meta = ALL_ROLES.find((x) => x.value === r);
                      return (
                        <Badge
                          key={r}
                          variant="secondary"
                          className={meta?.color}
                        >
                          {meta?.label ?? r}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {ALL_ROLES.map((r) => {
                    const has = u.roles.includes(r.value);
                    const key = `${u.user_id}:${r.value}`;
                    const busy = busyKey === key;
                    return (
                      <Button
                        key={r.value}
                        size="sm"
                        variant={has ? "secondary" : "outline"}
                        disabled={busy}
                        onClick={() =>
                          handleToggleRole(u.user_id, r.value, has)
                        }
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : has ? (
                          <X className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        <r.icon className="h-3 w-3 ml-1" />
                        <span className="ml-1">{r.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
