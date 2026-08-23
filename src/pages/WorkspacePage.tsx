import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Play, Edit, Folder, FileCode, LogOut, 
  CheckCircle, AlertCircle, Clock, Tag
} from 'lucide-react';
import CollectionModal from '../components/CollectionModal';
import NewTestModal from '../components/NewTestModal';
import TestBuilder from '../components/TestBuilder';
import Inspector from '../components/Inspector';
import type { Collection } from '../types';
import { backend } from "../backend";

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'builder' | 'inspector'>('list');
  const [activeTest, setActiveTest] = useState<any | null>(null);

  // Load state on mount
  useEffect(() => {
    const state = backend.loadState();
    setCollections(state.collections);
    if (state.collections.length > 0) {
      setActiveCollectionId(state.collections[0].id);
    }
  }, []);

  // Save state on change
  useEffect(() => {
    backend.saveState({ collections });
  }, [collections]);

  const activeCollection = collections.find(c => c.id === activeCollectionId) || null;
  const tests = activeCollection ? activeCollection.tests : [];

  const handleCreateCollection = (data: { name: string; url: string; color: string }) => {
    const newCollection: Collection = {
      id: Date.now().toString(),
      name: data.name,
      baseUrl: data.url,
      color: data.color,
      tests: [],
      createdAt: new Date().toISOString(),
    };
    setCollections([...collections, newCollection]);
    setActiveCollectionId(newCollection.id);
    setIsCollectionModalOpen(false);
  };

  const handleUpdateCollection = (data: { name: string; url: string; color: string }) => {
    if (!editingCollection) return;
    const updated = collections.map(c => 
      c.id === editingCollection.id 
        ? { ...c, name: data.name, baseUrl: data.url, color: data.color } 
        : c
    );
    setCollections(updated);
    setEditingCollection(null);
    setIsCollectionModalOpen(false);
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Вы уверены? Все тесты в этой коллекции будут удалены.')) {
      const filtered = collections.filter(c => c.id !== id);
      setCollections(filtered);
      if (activeCollectionId === id) {
        setActiveCollectionId(filtered.length > 0 ? filtered[0].id : null);
      }
    }
  };

  const handleCreateTest = (data: { name: string; path: string }) => {
    if (!activeCollectionId) return;
    
    const newTest: any = {
      id: Date.now().toString(),
      collectionId: activeCollectionId,
      name: data.name,
      path: data.path,
      status: 'created',
      tags: [],
      steps: [],
      viewports: [{ id: '1', name: 'Desktop', width: 1920, height: 1080 }],
      executors: [{ id: '1', name: 'Local Chrome', type: 'local' }],
      createdAt: new Date().toISOString(),
      lastRun: null,
    };

    const updatedCollections = collections.map(c => {
      if (c.id === activeCollectionId) {
        return { ...c, tests: [...c.tests, newTest] };
      }
      return c;
    });

    setCollections(updatedCollections);
    setIsTestModalOpen(false);
    // Open inspector for the new test
    setActiveTest(newTest);
    setViewMode('inspector');
  };

  const handleSaveTest = (updatedTest: any) => {
    const updatedCollections = collections.map(c => {
      if (c.id === updatedTest.collectionId) {
        return {
          ...c,
          tests: c.tests.map(t => t.id === updatedTest.id ? updatedTest : t)
        };
      }
      return c;
    });
    setCollections(updatedCollections);
    setActiveTest(updatedTest);
    setViewMode('inspector');
  };

  const handleRunTest = (test: any) => {
    alert(`Запуск теста: ${test.name}\n(Логика запуска будет реализована отдельно)`);
  };

  const openEditCollection = (e: React.MouseEvent, collection: Collection) => {
    e.stopPropagation();
    setEditingCollection(collection);
    setIsCollectionModalOpen(true);
  };

  return (
    <div className="flex h-screen bg-deep text-fog font-body overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-panel border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-fog">Коллекции</h2>
          <button 
            onClick={() => { setEditingCollection(null); setIsCollectionModalOpen(true); }}
            className="p-2 hover:bg-raised rounded-md transition-colors text-mist hover:text-fog"
            title="Создать коллекцию"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {collections.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-mist text-sm mb-2">Нет коллекций</p>
              <p className="text-mist text-xs opacity-70">Создайте первую коллекцию, чтобы начать работу</p>
            </div>
          ) : (
            collections.map(c => (
              <div
                key={c.id}
                onClick={() => { setActiveCollectionId(c.id); setViewMode('list'); }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  activeCollectionId === c.id 
                    ? 'bg-raised text-fog shadow-sm' 
                    : 'text-mist hover:bg-raised/50 hover:text-fog'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: c.color }} 
                  />
                  <span className="truncate font-medium text-sm">{c.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => openEditCollection(e, c)}
                    className="p-1 hover:bg-deep rounded text-mist hover:text-fog"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCollection(c.id); }}
                    className="p-1 hover:bg-red-900/30 rounded text-mist hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-mist hover:text-fog transition-colors text-sm w-full"
          >
            <LogOut size={16} />
            <span>На главную</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-deep">
        {viewMode === 'list' && (
          <>
            {/* Header */}
            <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-panel/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <h1 className="font-display font-bold text-xl text-fog">
                  {activeCollection ? activeCollection.name : 'Выберите коллекцию'}
                </h1>
                {activeCollection && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-raised text-mist border border-border">
                    {tests.length} тестов
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTestModalOpen(true)}
                  disabled={!activeCollection}
                  className="flex items-center gap-2 px-4 py-2 bg-ember hover:bg-orange-500 disabled:bg-mist/20 disabled:text-mist/50 text-white rounded-lg font-medium transition-all shadow-sm"
                >
                  <Plus size={18} />
                  <span>Новый тест</span>
                </button>
              </div>
            </header>

            {/* Tests List */}
            <div className="flex-1 overflow-y-auto p-6">
              {!activeCollection ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <Folder size={64} className="mb-4 text-mist" />
                  <h3 className="text-xl font-display font-semibold text-fog mb-2">Коллекция не выбрана</h3>
                  <p className="text-mist max-w-md">Выберите коллекцию слева или создайте новую, чтобы увидеть список тестов.</p>
                </div>
              ) : tests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <FileCode size={64} className="mb-4 text-mist" />
                  <h3 className="text-xl font-display font-semibold text-fog mb-2">Список пуст</h3>
                  <p className="text-mist max-w-md mb-6">В этой коллекции пока нет тестов. Создайте первый тест, чтобы начать работу.</p>
                  <button
                    onClick={() => setIsTestModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-ember hover:bg-orange-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-ember/20"
                  >
                    <Plus size={20} />
                    <span>Создать первый тест</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tests.map((test: any) => (
                    <div
                      key={test.id}
                      onClick={() => { setActiveTest(test); setViewMode('inspector'); }}
                      className="group bg-panel border border-border rounded-xl p-4 hover:border-ember/50 hover:shadow-lg hover:shadow-ember/5 transition-all cursor-pointer flex flex-col h-48"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${
                            test.status === 'passed' ? 'bg-sage/20 text-sage' :
                            test.status === 'failed' ? 'bg-ember/20 text-ember' :
                            'bg-mist/20 text-mist'
                          }`}>
                            {test.status === 'passed' ? <CheckCircle size={20} /> :
                             test.status === 'failed' ? <AlertCircle size={20} /> :
                             <Clock size={20} />}
                          </div>
                          <h3 className="font-display font-semibold text-fog truncate pr-2">{test.name}</h3>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-hidden mb-3">
                        <p className="text-xs text-mist font-mono bg-deep/50 p-2 rounded border border-border truncate">
                          {test.path}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          {test.tags && test.tags.slice(0, 3).map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-raised text-mist border border-border">
                              {tag}
                            </span>
                          ))}
                          {test.tags && test.tags.length > 3 && (
                            <span className="text-[10px] text-mist">+{test.tags.length - 3}</span>
                          )}
                        </div>
                        <button 
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-ember/20 hover:text-ember rounded transition-all"
                          title="Быстрый запуск"
                          onClick={(e) => { e.stopPropagation(); handleRunTest(test); }}
                        >
                          <Play size={14} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === 'inspector' && activeTest && (
          <Inspector 
            test={activeTest} 
            onBack={() => setViewMode('list')}
            onEdit={() => setViewMode('builder')}
            onRun={() => handleRunTest(activeTest)}
          />
        )}

        {viewMode === 'builder' && activeTest && (
          <TestBuilder 
            test={activeTest} 
            onSave={handleSaveTest}
            onCancel={() => setViewMode('inspector')}
          />
        )}
      </main>

      {/* Modals */}
      {isCollectionModalOpen && (
        <CollectionModal
          isOpen={true}
          onClose={() => { setIsCollectionModalOpen(false); setEditingCollection(null); }}
          onSubmit={editingCollection ? handleUpdateCollection : handleCreateCollection}
          initialData={editingCollection ? {
            name: editingCollection.name,
            url: editingCollection.baseUrl,
            color: editingCollection.color
          } : undefined}
          isEditing={!!editingCollection}
        />
      )}

      {isTestModalOpen && (
        <NewTestModal
          isOpen={true}
          onClose={() => setIsTestModalOpen(false)}
          onSubmit={handleCreateTest}
        />
      )}
    </div>
  );
};

export default WorkspacePage;
