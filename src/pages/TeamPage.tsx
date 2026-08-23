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
    <div className="min-h-screen bg-gray-50">
      {/* Header Component */}
      <Header />
      
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Команда</h1>
            <p className="text-gray-500 mt-1">Управление участниками вашей команды</p>
          </div>
          <button
            onClick={handleCopyInvite}
            className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-all ${
              copied
                ? "bg-green-100 text-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? "Скопировано" : "Пригласить"}</span>
          </button>
        </div>

        {/* Invite Section */}
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Пригласить участника
              </h2>
              <p className="text-gray-500 text-sm max-w-xl">
                Отправьте ссылку коллегам, чтобы они могли присоединиться к вашей команде. 
                Все участники получат доступ к проектам и тестам аккаунта.
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-500 truncate">
              {getInviteLink()}
            </div>
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-all"
            >
              {copied ? <Check size={16} className="text-sage" /> : <Copy size={16} />}
              <span>{copied ? "Скопировано" : "Копировать"}</span>
            </button>
          </div>
        </section>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-12 pr-4 py-3 text-gray-900 placeholder-mist/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Team Members Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                {searchQuery ? <Search size={32} className="text-gray-500" /> : <Plus size={32} className="text-gray-500" />}
              </div>
              <h3 className="font-semibold text-lg font-bold text-gray-900 mb-2">
                {searchQuery ? "Ничего не найдено" : "В команде пока никого нет"}
              </h3>
              <p className="text-gray-500 text-sm max-w-md">
                {searchQuery 
                  ? "Попробуйте изменить поисковый запрос" 
                  : "Пригласите участников команды, используя ссылку выше"}
              </p>
            </div>
          ) : (
            filteredMembers.map(member => {
              const RoleIcon = ROLE_META[member.role]?.icon || Shield;
              const roleColor = ROLE_META[member.role]?.color || "#60a5fa";
              
              return (
                <div
                  key={member.id}
                  className="group relative rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-lg transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-amber/20 text-[15px] font-extrabold text-amber">
                        {member.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold font-bold text-gray-900 truncate max-w-[180px]">
                          {member.name}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">{member.email}</p>
                      </div>
                    </div>
                    
                    {/* Role Badge */}
                    <div className="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1">
                      <RoleIcon size={12} style={{ color: roleColor }} />
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: roleColor }}>
                        {ROLE_META[member.role]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
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
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
                    {/* Role Selector */}
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as "admin" | "qa" | "dev")}
                      className="text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          className="rounded bg-coral px-2 py-1 text-[10px] font-bold text-[#2b0f0b] hover:brightness-110"
                        >
                          Да
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="rounded border border-line bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-900"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(member.id)}
                        className="p-2 text-gray-500 hover:text-red-600 transition-colors"
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
              
              return (
                <div key={role} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon size={18} style={{ color: meta.color }} />
                    <span className="text-sm font-semibold text-gray-500">{meta.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
