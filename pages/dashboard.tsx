import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

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

interface SidebarItem {
  id: string;
  type: 'folder' | 'page';
  name: string;
  icon: string;
  folderId?: number | null;
  pageCount?: number;
  level: number;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<PageData[]>([]);
  const [deletedPages, setDeletedPages] = useState<PageData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);


  const loadData = useCallback(async () => {
    try {
      if (!user) {
        return;
      }

      // Get the current session token
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        console.error('Authentication token not found');
        return;
      }

      // Fetch user's pages
      const pagesResponse = await fetch('/api/pages', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Fetch user's folders
      const foldersResponse = await fetch('/api/folders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pagesResponse.ok || !foldersResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const pagesData = await pagesResponse.json();
      const foldersData = await foldersResponse.json();

      setPages(pagesData.pages || []);
      setDeletedPages(pagesData.deletedPages || []);
      setFolders(foldersData.folders || []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [user]);

  // Load data when user is authenticated
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, loadData]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        alert('Authentication required');
        return;
      }

      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newFolderName.trim() })
      });

      if (response.ok) {
        // Reload data to show the new folder
        await loadData();
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



  // Set initial selection when component loads
  useEffect(() => {
    if (!selectedItem && sidebarItems.length > 0) {
      setSelectedItem(sidebarItems[0].id);
    }
  }, [selectedItem, sidebarItems]);









    return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
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
              <div className="space-y-2">
                <Link 
                  href="/editor" 
                  className="block w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors text-center"
                >
                  New Page
                </Link>
                <button
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="block w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors text-center"
                >
                  Add Folder
                </button>
              </div>
            )}
          </div>

          {/* New Folder Input */}
          {!sidebarCollapsed && showNewFolderInput && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createFolder();
                    if (e.key === 'Escape') {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }
                  }}
                  autoFocus
                />
                <div className="flex space-x-2">
                  <button
                    onClick={createFolder}
                    disabled={isCreatingFolder || !newFolderName.trim()}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreatingFolder ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }}
                    className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarItems.length === 0 ? (
              <div className="flex items-center justify-center p-4 h-full">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-sm">No content yet</p>
                  <Link 
                    href="/editor" 
                    className="mt-4 inline-block text-blue-600 hover:text-blue-500 text-sm"
                  >
                    Create your first page
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {sidebarItems.map((item) => (
                  <div
                    key={item.id}
                    className={`
                      flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                      rounded-md transition-colors duration-150
                      ${selectedItem === item.id ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                    `}
                    style={{ paddingLeft: `${12 + (item.level * 16)}px` }}
                    onClick={() => setSelectedItem(item.id)}
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
            <div className="p-4 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="truncate">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-500 ml-2"
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Main Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-6">
                          <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {selectedItem === 'trash' ? 'Trash' : 
                     selectedItem.startsWith('folder-') ? 
                       folders.find(f => f.id === parseInt(selectedItem.replace('folder-', '')))?.name || 'Folder' :
                     'Dashboard'}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {displayedPages.length} {displayedPages.length === 1 ? 'page' : 'pages'}
                  </p>
                </div>
              </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto">
            {displayedPages.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">
                  {selectedItem === 'trash' ? '🗑️' : '✨'}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedItem === 'trash' ? 'Trash is empty' : 'Welcome to Borrd'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {selectedItem === 'trash' 
                    ? 'Deleted pages will appear here.' 
                    : 'Create your first page to get started.'
                  }
                </p>
                {selectedItem !== 'trash' && (
                  <Link 
                    href="/editor" 
                    className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Your First Page
                  </Link>
                )}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {displayedPages.map((page) => {
                  return (
                    <div 
                      key={page.id} 
                      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
                    >
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
                            
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
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
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 ml-4">
                            <Link 
                              href={`/${page.slug}`}
                              className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
                            >
                              View Page
                            </Link>
                            <Link 
                              href={`/editor?slug=${page.slug}`}
                              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="prose prose-sm max-w-none">
                          {page.markdown && page.markdown.trim() ? (
                            <div className="text-gray-600 leading-relaxed">
                              {truncateContent(page.markdown, 300)}
                            </div>
                          ) : (
                            <div className="text-gray-500 italic text-center py-8">
                              This page is empty. Click &quot;Edit&quot; to add content.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 