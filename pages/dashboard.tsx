import React, { useState, useMemo, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import CustomMarkdown from '../components/CustomMarkdown';

interface PageData {
  id: number;
  slug: string;
  folder_id?: number | null;
  deleted_at?: string | null;
  markdown?: string;
  created_at?: string;
  updated_at?: string;
}

interface FolderData {
  id: number;
  name: string;
  parent_id?: number | null;
  created_at: string;
}

interface DashboardProps {
  pages: PageData[];
  deletedPages: PageData[];
  folders: FolderData[];
  error?: string;
}

interface SidebarItem {
  id: string;
  type: 'folder' | 'page';
  name: string;
  icon: string;
  folderId?: number | null;
  pageCount?: number;
  level: number;
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async () => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        props: {
          pages: [],
          deletedPages: [],
          folders: [],
          error: 'Supabase configuration missing'
        }
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all non-deleted pages with markdown content
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Fetch deleted pages
    const { data: deletedPages, error: deletedError } = await supabase
      .from('pages')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    // Fetch folders
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (pagesError || deletedError || foldersError) {
      console.error('Error fetching data:', { pagesError, deletedError, foldersError });
      return {
        props: {
          pages: [],
          deletedPages: [],
          folders: [],
          error: 'Failed to load data'
        }
      };
    }

    return {
      props: {
        pages: pages || [],
        deletedPages: deletedPages || [],
        folders: folders || []
      }
    };

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      props: {
        pages: [],
        deletedPages: [],
        folders: [],
        error: 'Internal server error'
      }
    };
  }
};

export default function Dashboard({ pages: initialPages, deletedPages: initialDeletedPages, folders: initialFolders, error }: DashboardProps) {
  const [pages, setPages] = useState<PageData[]>(initialPages);
  const [deletedPages, setDeletedPages] = useState<PageData[]>(initialDeletedPages);
  const [folders, setFolders] = useState<FolderData[]>(initialFolders);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{type: 'page' | 'folder', id: number, folderId?: number} | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Helper function to truncate markdown content
  const truncateContent = (markdown: string, maxLength: number = 200) => {
    // Remove markdown syntax for preview
    const plainText = markdown
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    return plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText;
  };

  // Generate mock metadata for pages
  const generatePageMetadata = (page: PageData) => {
    // Generate consistent "random" data based on page ID
    const seed = page.id;
    const views = (seed * 7 + 42) % 1000 + 10;
    const lastViewed = new Date(Date.now() - (seed * 1000 * 60 * 60 * 24) % (30 * 24 * 60 * 60 * 1000));
    
    return {
      views,
      lastViewed,
      readTime: Math.max(1, Math.floor((page.markdown?.length || 0) / 200))
    };
  };

  // Build sidebar items list
  const sidebarItems = useMemo(() => {
    const items: SidebarItem[] = [];
    const processedPageIds = new Set<number>();
    
    // Add regular folders and their pages FIRST
    const processFolder = (folderId: number, level: number = 0) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      const folderPages = pages.filter(p => p.folder_id === folderId);
      
      items.push({
        id: `folder-${folderId}`,
        type: 'folder',
        name: folder.name,
        icon: '📁',
        pageCount: folderPages.length,
        level
      });

      // Add pages in this folder
      folderPages.forEach(page => {
        processedPageIds.add(page.id);
        items.push({
          id: `page-${page.id}`,
          type: 'page',
          name: page.slug,
          icon: '📄',
          folderId: page.folder_id,
          level: level + 1
        });
      });

      // Add child folders
      const childFolders = folders.filter(f => f.parent_id === folderId);
      childFolders.forEach(child => processFolder(child.id, level + 1));
    };

    // Process top-level folders first
    const topLevelFolders = folders.filter(f => f.parent_id === null);
    topLevelFolders.forEach(folder => processFolder(folder.id, 0));

    // Then add truly uncategorized pages (pages not processed above)
    const uncategorizedPages = pages.filter(p => p.folder_id === null && !processedPageIds.has(p.id));
    uncategorizedPages.forEach(page => {
      items.push({
        id: `page-${page.id}`,
        type: 'page',
        name: page.slug,
        icon: '📄',
        folderId: null,
        level: 0
      });
    });

    // Add trash folder if needed
    if (deletedPages.length > 0) {
      items.push({
        id: 'trash',
        type: 'folder',
        name: 'Trash',
        icon: '🗑️',
        pageCount: deletedPages.length,
        level: 0
      });
    }

    return items;
  }, [pages, folders, deletedPages]);

  // Get displayed pages based on selection
  const getDisplayedPages = () => {
    if (selectedItem === 'trash') {
      return deletedPages;
    } else if (selectedItem.startsWith('folder-')) {
      const folderId = parseInt(selectedItem.replace('folder-', ''));
      return pages.filter(page => page.folder_id === folderId);
    } else if (selectedItem.startsWith('page-')) {
      const pageId = parseInt(selectedItem.replace('page-', ''));
      const page = pages.find(p => p.id === pageId);
      return page ? [page] : [];
    }
    // Default to all pages if no selection
    return pages;
  };

  const displayedPages = getDisplayedPages();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') {
        return; // Don't interfere with input fields
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = sidebarItems.findIndex(item => item.id === selectedItem);
        if (currentIndex > 0) {
          setSelectedItem(sidebarItems[currentIndex - 1].id);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = sidebarItems.findIndex(item => item.id === selectedItem);
        if (currentIndex < sidebarItems.length - 1) {
          setSelectedItem(sidebarItems[currentIndex + 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, sidebarItems]);

  // Reset page index when selection changes
  useEffect(() => {
    setSelectedPageIndex(0);
  }, [selectedItem]);

  // Set initial selection when component loads
  useEffect(() => {
    if (!selectedItem && sidebarItems.length > 0) {
      setSelectedItem(sidebarItems[0].id);
    }
  }, [selectedItem, sidebarItems]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() })
      });

      if (response.ok) {
        const foldersResponse = await fetch('/api/folders');
        const foldersData = await foldersResponse.json();
        setFolders(foldersData.folders);
        setNewFolderName('');
        setShowNewFolderInput(false);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const movePageToFolder = async (pageId: number, targetFolderId: number | null) => {
    try {
      const response = await fetch('/api/move-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, folderId: targetFolderId })
      });

      if (response.ok) {
        setPages(prevPages => 
          prevPages.map(page => {
            if (page.id === pageId) {
              return { ...page, folder_id: targetFolderId };
            }
            return page;
          })
        );
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to move page');
      }
    } catch (error) {
      console.error('Error moving page:', error);
      alert('Failed to move page');
    }
  };

  const restorePage = async (pageId: number) => {
    try {
      const response = await fetch('/api/delete-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, restore: true })
      });

      if (response.ok) {
        const restoredPage = deletedPages.find(p => p.id === pageId);
        if (restoredPage) {
          setDeletedPages(prev => prev.filter(p => p.id !== pageId));
          setPages(prev => [...prev, { ...restoredPage, deleted_at: null }]);
        }
      } else {
        alert('Failed to restore page');
      }
    } catch (error) {
      console.error('Error restoring page:', error);
      alert('Failed to restore page');
    }
  };

  const exportPages = async (includeDeleted = false) => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeDeleted })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `borrd-export-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export pages');
      }
    } catch (error) {
      console.error('Error exporting pages:', error);
      alert('Failed to export pages');
    } finally {
      setIsExporting(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'page' | 'folder', id: number, folderId?: number) => {
    setDraggedItem({ type, id, folderId });
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedItem && (targetId.startsWith('folder-') || targetId === 'uncategorized')) {
      setDropTarget(targetId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.type === 'page') {
      let folderId: number | null = null;
      
      if (targetId.startsWith('folder-')) {
        folderId = parseInt(targetId.replace('folder-', ''));
      } else if (targetId === 'uncategorized') {
        folderId = null;
      }
      
      await movePageToFolder(draggedItem.id, folderId);
    }

    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
  };

  const getCurrentViewName = () => {
    if (selectedItem === 'trash') return 'Trash';
    if (selectedItem.startsWith('folder-')) {
      const folderId = parseInt(selectedItem.replace('folder-', ''));
      const folder = folders.find(f => f.id === folderId);
      return folder ? folder.name : 'Unknown Folder';
    }
    if (selectedItem.startsWith('page-')) {
      const pageId = parseInt(selectedItem.replace('page-', ''));
      const page = pages.find(p => p.id === pageId);
      return page ? page.slug : 'Unknown Page';
    }
    return 'Dashboard';
  };

  const isTrashView = selectedItem === 'trash';

    return (
    <div className={`min-h-screen bg-gray-50 flex ${isDragging ? 'select-none' : ''}`}>
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className={`font-bold text-gray-900 transition-all duration-300 ${sidebarCollapsed ? 'text-lg' : 'text-2xl'}`}>
              {sidebarCollapsed ? 'B' : 'Borrd'}
            </h1>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            </div>

          {!sidebarCollapsed && (
            <>
              <div className="flex space-x-2 mb-4">
                <Link 
                  href="/editor" 
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors text-center"
                >
                  New Page
                </Link>
                <button
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                >
                  +
                </button>
              </div>

              {/* New Folder Input */}
              {showNewFolderInput && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createFolder();
                      if (e.key === 'Escape') setShowNewFolderInput(false);
                    }}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={createFolder}
                      disabled={isCreatingFolder || !newFolderName.trim()}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingFolder ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }}
                      className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto">
          {sidebarCollapsed ? (
            // Collapsed sidebar - just icons
            <div className="p-2 space-y-1">
              {sidebarItems.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item.id)}
                  className={`w-full p-3 rounded-md transition-colors ${
                    selectedItem === item.id ? 'bg-blue-100 text-blue-900' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={item.name}
                >
                  <span className="text-lg">{item.icon}</span>
                </button>
              ))}
            </div>
          ) : (
            // Full sidebar
            <div className="p-4 space-y-1">
              {sidebarItems.map((item) => (
                <div
                  key={item.id}
                  className={`
                    flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                    rounded-md transition-colors duration-150
                    ${selectedItem === item.id ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                    ${dropTarget === item.id ? 'bg-green-50 ring-2 ring-green-300' : ''}
                  `}
                  style={{ paddingLeft: `${12 + (item.level * 16)}px` }}
                  onClick={() => setSelectedItem(item.id)}
                  onDragOver={(e) => item.type === 'folder' && handleDragOver(e, item.id)}
                  onDrop={(e) => item.type === 'folder' && handleDrop(e, item.id)}
                  draggable={item.type === 'page'}
                  onDragStart={(e) => {
                    if (item.type === 'page') {
                      const pageId = parseInt(item.id.replace('page-', ''));
                      handleDragStart(e, 'page', pageId, item.folderId);
                    }
                  }}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center min-w-0">
                    <span className="mr-2 flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.pageCount !== undefined && item.pageCount > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
                      {item.pageCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => exportPages(false)}
              disabled={isExporting || pages.length === 0}
              className="w-full px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export Pages'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Drag indicator */}
        {isDragging && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span>Drag to folder to organize</span>
                </div>
              </div>
            )}
            
        {/* Main Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{getCurrentViewName()}</h2>
              <p className="text-gray-600 mt-1">
                {displayedPages.length} {displayedPages.length === 1 ? 'page' : 'pages'}
                {displayedPages.length > 1 && (
                  <span className="ml-2">• Viewing page {selectedPageIndex + 1}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {displayedPages.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">
                {selectedItem === 'trash' ? '🗑️' : 
                 selectedItem === 'uncategorized' ? '📄' : 
                 selectedItem === 'all' ? '📋' : '📁'}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedItem === 'trash' ? 'Trash is empty' :
                 selectedItem === 'uncategorized' ? 'No uncategorized pages' :
                 selectedItem === 'all' ? 'No pages yet' : 'This folder is empty'}
              </h3>
              <p className="text-gray-600 mb-6">
                {selectedItem === 'all' ? 'Create your first page to get started.' :
                 selectedItem === 'trash' ? 'Deleted pages will appear here.' :
                 'Move pages here or create new ones to organize your content.'}
              </p>
              {selectedItem === 'all' && (
                <Link 
                  href="/editor" 
                  className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Your First Page
                </Link>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* Display single page as a preview card */}
              {displayedPages[selectedPageIndex] && (() => {
                const page = displayedPages[selectedPageIndex];
                const metadata = generatePageMetadata(page);
                const isPageDragged = draggedItem && draggedItem.type === 'page' && draggedItem.id === page.id;
                  
                  return (
                    <div 
                      key={page.id} 
                      className={`
                      bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300
                      ${!isTrashView ? "cursor-pointer" : ""}
                        ${isPageDragged ? "opacity-50" : ""}
                      `}
                    draggable={!isTrashView}
                    onDragStart={(e) => !isTrashView && handleDragStart(e, 'page', page.id, page.folder_id)}
                      onDragEnd={handleDragEnd}
                    >
                    {/* Page Header */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">📄</span>
                            <h1 className="text-2xl font-bold text-gray-900 truncate">
                              {page.slug}
                            </h1>
                          </div>
                          <p className="text-sm text-gray-500 mb-4">
                            <span className="font-mono text-blue-600">/{page.slug}</span>
                          </p>
                          
                          {/* Metadata */}
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>{metadata.views} views</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{metadata.readTime} min read</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Created {new Date(page.created_at!).toLocaleDateString()}</span>
                            </div>
                            {page.updated_at && page.updated_at !== page.created_at && (
                              <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Updated {new Date(page.updated_at).toLocaleDateString()}</span>
                              </div>
                            )}
                            {isTrashView && page.deleted_at && (
                              <div className="flex items-center space-x-1 text-red-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Deleted {new Date(page.deleted_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 ml-4">
                          {isTrashView ? (
                            <button
                              onClick={() => restorePage(page.id)}
                              className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <Link 
                                href={`/${page.slug}`}
                                className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Page
                              </Link>
                              <Link 
                                href={`/editor?slug=${page.slug}`}
                                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Edit
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Page Preview */}
                    <div className="p-6">
                      <div className="prose prose-sm max-w-none">
                        {page.markdown && page.markdown.trim() ? (
                          <div className="space-y-4">
                            {/* Truncated content preview */}
                            <div className="text-gray-600 leading-relaxed">
                              {truncateContent(page.markdown, 300)}
              </div>

                            {/* Full markdown preview (first 1000 chars) */}
                            {page.markdown.length > 300 && (
                              <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">Preview:</h4>
                                <div className="max-h-64 overflow-hidden relative">
                                  <CustomMarkdown>
                                    {page.markdown.substring(0, 1000) + (page.markdown.length > 1000 ? '...' : '')}
                                  </CustomMarkdown>
                                  {page.markdown.length > 1000 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
                                  )}
                                </div>
              </div>
            )}
          </div>
                        ) : (
                          <div className="text-gray-500 italic text-center py-8">
                            This page is empty. Click "Edit" to add content.
          </div>
        )}
      </div>
            </div>
          </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 