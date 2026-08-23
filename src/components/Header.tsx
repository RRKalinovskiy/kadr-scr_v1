import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateStatus } = useAuthStore();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const statuses = [
    { id: 'online', label: 'В сети', color: 'bg-green-500' },
    { id: 'busy', label: 'Занят', color: 'bg-red-500' },
    { id: 'away', label: 'Отошел', color: 'bg-yellow-500' },
    { id: 'offline', label: 'Не беспокоить', color: 'bg-gray-500' },
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => handleNavClick('/workspace')}>
              <div className="h-7 w-7 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">
                К
              </div>
              <span className="ml-2 text-lg font-semibold text-gray-900 hidden sm:block tracking-tight">КАДР</span>
            </div>
            
            <div className="hidden sm:ml-10 sm:flex sm:space-x-1">
              {[
                { path: '/workspace', label: 'Рабочее место' },
                { path: '/team', label: 'Сотрудники' },
                { path: '/statistics', label: 'Статистика облака' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`
                    inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium rounded-t-md transition-colors duration-200 h-full
                    ${isActive(item.path)
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 focus:outline-none p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <div className="text-right hidden md:block mr-1">
                  <div className="text-sm font-medium text-gray-900 leading-tight">{user?.name || 'Пользователь'}</div>
                  <div className={`text-xs flex items-center justify-end gap-1.5 mt-0.5 ${currentStatus.id === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${currentStatus.color} ring-2 ring-white`}></span>
                    {currentStatus.label}
                  </div>
                </div>
                <div className="relative">
                  <img
                    className="h-8 w-8 rounded-full bg-gray-200 object-cover ring-2 ring-gray-100"
                    src={user?.avatar || 'https://via.placeholder.com/150'}
                    alt="Avatar"
                  />
                  <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${currentStatus.color}`}></span>
                </div>
              </button>

              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsProfileOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm text-gray-500">Ваш статус</p>
                      <button 
                        onClick={() => setIsStatusModalOpen(true)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 w-full text-left mt-1"
                      >
                        Изменить статус
                      </button>
                    </div>
                    
                    <a
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/settings');
                        setIsProfileOpen(false);
                      }}
                    >
                      Настройки
                    </a>
                    
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Выйти
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsStatusModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Выберите статус</h3>
                <div className="grid grid-cols-1 gap-3">
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => handleStatusChange(status.id)}
                      className={`flex items-center p-3 rounded-md border ${user?.status === status.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <span className={`w-3 h-3 rounded-full mr-3 ${status.color}`}></span>
                      <span className="text-gray-700 font-medium">{status.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
