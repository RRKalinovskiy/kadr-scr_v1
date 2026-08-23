import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from '../components/Header';
import { 
  ArrowLeft, Plus, Copy, Check, Edit2, Trash2, Mail, Phone, 
  Shield, UserCheck, UserX, Search, MoreVertical
} from "lucide-react";
import { db } from "../backend/db";
import type { DbUser, DbAccount } from "../backend/db";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "qa" | "dev";
  createdAt: number;
  lastActive?: number;
}

const ROLE_META: Record<string, { label: string; color: string; icon: any }> = {
  admin: { label: "Администратор", color: "#ff7a68", icon: Shield },
  qa: { label: "QA Инженер", color: "#46d68c", icon: UserCheck },
  dev: { label: "Разработчик", color: "#60a5fa", icon: UserX },
};

export default function TeamPage() {
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState<string>("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Команда — КАДР";
    
    // Получаем accountId из токена
    const token = localStorage.getItem("kadr-regapi-token");
    let accId = "default";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        accId = payload.accountId || payload.sub || "default";
      } catch {
        accId = "default";
      }
    }
    setAccountId(accId);

    // Загружаем участников команды
    loadTeamMembers(accId);
  }, []);

  const loadTeamMembers = (accId: string) => {
    const users = db.listUsers().filter(u => u.accountId === accId);
    const teamMembers: TeamMember[] = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: "dev", // По умолчанию все пользователи - разработчики
      createdAt: u.createdAt,
      lastActive: undefined,
    }));
    setMembers(teamMembers);
  };

  const getInviteLink = () => {
    const token = localStorage.getItem("kadr-regapi-token");
    const inviteToken = token ? token.split(".")[0] : "demo";
    return `${window.location.origin}/auth?invite=${inviteToken}`;
  };

  const handleCopyInvite = () => {
    const link = getInviteLink();
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = (memberId: string, newRole: "admin" | "qa" | "dev") => {
    // В реальной реализации здесь было бы обновление в БД
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    ));
  };

  const handleDeleteMember = (memberId: string) => {
    // В реальной реализации здесь было бы удаление из БД
    setMembers(prev => prev.filter(m => m.id !== memberId));
    setShowDeleteConfirm(null);
  };

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-deep">
      {/* Header Component */}
      <Header />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] font-bold text-fog">Команда</h1>
            <p className="text-mist mt-1 text-sm">Управление участниками вашей команды</p>
          </div>
          <button
            onClick={handleCopyInvite}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition-all ${
              copied
                ? "bg-sage text-[#17211d]"
                : "bg-amber text-[#17211d] hover:bg-amber2"
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? "Скопировано" : "Пригласить"}</span>
          </button>
        </div>

        {/* Invite Section */}
        <section className="mb-6 rounded-xl border border-border bg-panel p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-fog mb-2">
                Пригласить участника
              </h2>
              <p className="text-mist text-sm max-w-xl">
                Отправьте ссылку коллегам, чтобы они могли присоединиться к вашей команде. 
                Все участники получат доступ к проектам и тестам аккаунта.
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="p-3 bg-amber/10 rounded-lg">
                <Plus size={24} className="text-amber" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-border bg-deep px-4 py-3 font-mono text-sm text-mist truncate">
              {getInviteLink()}
            </div>
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-2 rounded-lg border border-border bg-raised px-4 py-3 text-sm font-semibold text-mist hover:bg-raised/70 transition-all"
            >
              {copied ? <Check size={16} className="text-sage" /> : <Copy size={16} />}
              <span>{copied ? "Скопировано" : "Копировать"}</span>
            </button>
          </div>
        </section>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-mist" size={20} />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel pl-12 pr-4 py-3 text-fog placeholder-mist/50 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        {/* Team Members Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-raised rounded-full mb-4">
                {searchQuery ? <Search size={32} className="text-mist" /> : <Plus size={32} className="text-mist" />}
              </div>
              <h3 className="font-display font-semibold text-lg text-fog mb-2">
                {searchQuery ? "Ничего не найдено" : "В команде пока никого нет"}
              </h3>
              <p className="text-mist text-sm max-w-md">
                {searchQuery 
                  ? "Попробуйте изменить поисковый запрос" 
                  : "Пригласите участников команды, используя ссылку выше"}
              </p>
            </div>
          ) : (
            filteredMembers.map(member => {
              const RoleIcon = ROLE_META[member.role]?.icon || Shield;
              const roleColor = member.role === "admin" ? "#ff7a68" : member.role === "qa" ? "#46d68c" : "#60a5fa";
              
              return (
                <div
                  key={member.id}
                  className="group relative rounded-xl border border-border bg-panel p-5 hover:border-amber/50 hover:shadow-lg transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-amber/20 text-amber">
                        {member.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-fog truncate max-w-[180px]">
                          {member.name}
                        </h3>
                        <p className="text-xs text-mist font-mono">{member.email}</p>
                      </div>
                    </div>
                    
                    {/* Role Badge */}
                    <div className="flex items-center gap-1.5 rounded bg-raised px-2 py-1">
                      <RoleIcon size={12} style={{ color: roleColor }} />
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: roleColor }}>
                        {ROLE_META[member.role]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-mist">
                      <Mail size={14} />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.lastActive && (
                      <div className="flex items-center gap-2 text-xs text-dim">
                        <span>Был в сети:</span>
                        <span>{new Date(member.lastActive).toLocaleDateString("ru-RU")}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    {/* Role Selector */}
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as "admin" | "qa" | "dev")}
                      className="text-xs rounded-lg border border-border bg-raised px-2 py-1.5 text-fog focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                    >
                      <option value="admin">Администратор</option>
                      <option value="qa">QA Инженер</option>
                      <option value="dev">Разработчик</option>
                    </select>

                    {/* Delete Button */}
                    {showDeleteConfirm === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="rounded bg-ember/20 px-2 py-1 text-[10px] font-bold text-ember hover:bg-ember/30"
                        >
                          Да
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="rounded border border-border bg-raised px-2 py-1 text-[10px] font-bold text-mist hover:text-fog"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(member.id)}
                        className="p-2 text-mist hover:text-ember transition-colors"
                        title="Удалить из команды"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Stats Summary */}
        {members.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {(["admin", "qa", "dev"] as const).map(role => {
              const count = members.filter(m => m.role === role).length;
              const meta = ROLE_META[role];
              const Icon = meta.icon;
              const roleColor = role === "admin" ? "#ff7a68" : role === "qa" ? "#46d68c" : "#60a5fa";
              
              return (
                <div key={role} className="rounded-xl border border-border bg-panel p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon size={18} style={{ color: roleColor }} />
                    <span className="text-sm font-semibold text-mist">{meta.label}</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-fog">{count}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
