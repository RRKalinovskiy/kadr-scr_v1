import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ChevronDown } from 'lucide-react';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateStatus } = useAuthStore();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const statuses = [
    { id: 'online', label: 'В сети', color: 'bg-sage' },
    { id: 'busy', label: 'Занят', color: 'bg-ember' },
    { id: 'away', label: 'Отошел', color: 'bg-amber' },
    { id: 'offline', label: 'Не беспокоить', color: 'bg-mist' },
  ];

  const currentStatus = statuses.find(s => s.id === user?.status) || statuses[0];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleStatusChange = (statusId: string) => {
    updateStatus(statusId);
    setIsStatusModalOpen(false);
    setIsProfileOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-panel/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1920px] items-center justify-between px-6">
        
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => handleNavClick('/workspace')}
          >
            <div className="h-8 w-8 rounded-lg bg-amber flex items-center justify-center text-[#17211d] font-bold text-sm shadow-lg">
              К
            </div>
            <span className="font-display text-lg font-bold text-fog tracking-tight">КАДР</span>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { path: '/workspace', label: 'Рабочее место' },
              { path: '/team', label: 'Сотрудники' },
              { path: '/statistics', label: 'Статистика облака' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                  ${isActive(item.path)
                    ? 'bg-raised text-fog shadow-sm'
                    : 'text-mist hover:text-fog hover:bg-raised/50'}
                `}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Profile Section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-raised transition-colors"
            >
              <div className="text-right hidden lg:block">
                <div className="text-sm font-bold text-fog leading-tight">{user?.name || 'Пользователь'}</div>
                <div className="text-xs flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${currentStatus.color} ring-2 ring-panel`}></span>
                  <span className="text-mist">{currentStatus.label}</span>
                </div>
              </div>
              <div className="relative">
                <img
                  className="h-9 w-9 rounded-lg bg-raised object-cover ring-2 ring-border"
                  src={user?.avatar || 'https://via.placeholder.com/150'}
                  alt="Avatar"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-panel ${currentStatus.color}`}></span>
              </div>
              <ChevronDown size={16} className="text-mist" />
            </button>

            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsProfileOpen(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-56 bg-panel rounded-xl shadow-2xl py-2 z-20 ring-1 ring-border">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-semibold text-mist uppercase tracking-wide">Статус</p>
                    <button 
                      onClick={() => setIsStatusModalOpen(true)}
                      className="text-sm font-medium text-amber hover:text-amber2 w-full text-left mt-1 transition-colors"
                    >
                      Изменить статус
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-mist hover:text-fog hover:bg-raised transition-colors"
                  >
                    Настройки
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-ember hover:bg-ember/10 transition-colors"
                  >
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsStatusModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-panel rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ring-1 ring-border">
              <div className="bg-panel px-6 pt-6 pb-4">
                <h3 className="text-lg font-display font-bold text-fog mb-4">Выберите статус</h3>
                <div className="grid grid-cols-1 gap-3">
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => handleStatusChange(status.id)}
                      className={`flex items-center p-3 rounded-lg border transition-all ${
                        user?.status === status.id 
                          ? 'border-amber bg-amber/10' 
                          : 'border-border bg-raised/50 hover:bg-raised'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full mr-3 ${status.color}`}></span>
                      <span className="text-fog font-medium">{status.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-deep/50 px-6 py-4 border-t border-line">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-bold text-mist hover:bg-raised transition-colors"
                  onClick={() => setIsStatusModalOpen(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
