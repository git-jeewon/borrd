import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import CustomMarkdown from '../components/CustomMarkdown';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface SlugSuggestion {
  slug: string;
  created_at: string;
  type?: 'page';
}

export default function Editor() {
  const { user } = useAuth();
  const router = useRouter();
  const [markdown, setMarkdown] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [slugSuggestions, setSlugSuggestions] = useState<SlugSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [pageExists, setPageExists] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search for slugs (pages only, since folders don't have URLs)
  const searchSlugs = useCallback(
    debounce(async (searchTerm: string) => {
      if (!searchTerm.trim()) {
        setSlugSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        // Search for pages only for this user
        const session = await supabase.auth.getSession();
        if (!session.data.session) return;
        
        const { data: pages, error: pagesError } = await supabase
          .from('pages')
          .select('slug, created_at')
          .eq('user_id', session.data.session.user.id)
          .ilike('slug', `%${searchTerm}%`)
          .is('deleted_at', null) // Only show non-deleted pages
          .limit(10);

        if (pagesError) {
          console.error('Error fetching suggestions:', pagesError);
          return;
        }

        // Format suggestions
        const suggestions: SlugSuggestion[] = (pages || []).map(page => ({ 
          slug: page.slug, 
          created_at: page.created_at,
          type: 'page' as const
        }));

        // Sort by relevance (exact matches first, then by creation date)
        suggestions.sort((a, b) => {
          const aExact = a.slug.toLowerCase() === searchTerm.toLowerCase();
          const bExact = b.slug.toLowerCase() === searchTerm.toLowerCase();
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setSlugSuggestions(suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(-1);
      } catch (error) {
        console.error('Error searching slugs:', error);
      }
    }, 300),
    []
  );

  // Load content for a specific slug (page only)
  const loadContentForSlug = async (selectedSlug: string) => {
    if (!user) return;
    
    setIsLoadingContent(true);
    try {
      const session = await supabase.auth.getSession();
      const currentUser = session.data.session?.user;
      
      if (!currentUser) {
        setPageExists(false);
        setIsLoadingContent(false);
        return;
      }

      const { data, error } = await supabase
        .from('pages')
        .select('markdown')
        .eq('slug', selectedSlug)
        .eq('user_id', currentUser.id)
        .is('deleted_at', null) // Only load non-deleted pages
        .single();

      if (error) {
        console.error('Error fetching content:', error);
        setPageExists(false);
        return;
      }

      if (data) {
        setMarkdown(data.markdown);
        setPageExists(true);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      setPageExists(false);
    } finally {
      setIsLoadingContent(false);
    }
  };



  // Handle slug input changes
  const handleSlugChange = (value: string) => {
    setSlug(value);
    searchSlugs(value);
    // Reset page existence when manually changing slug
    if (value !== slug) {
      setPageExists(false);
    }
  };

  // Handle keyboard navigation in suggestions
  const handleSlugKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || slugSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < slugSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          const selectedSlug = slugSuggestions[selectedSuggestionIndex].slug;
          setSlug(selectedSlug);
          loadContentForSlug(selectedSlug);
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SlugSuggestion) => {
    setSlug(suggestion.slug);
    loadContentForSlug(suggestion.slug);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Load content from URL parameter on mount
  useEffect(() => {
    if (router.isReady) {
      // Handle page/folder editing
      if (router.query.slug && typeof router.query.slug === 'string') {
        const slugFromUrl = router.query.slug;
        setSlug(slugFromUrl);
        loadContentForSlug(slugFromUrl);
      }
    }
  }, [router.isReady, router.query.slug]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce utility function
  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const handlePublish = async () => {
    if (!markdown.trim()) {
      alert('Please enter some content before publishing.');
      return;
    }

    if (!slug.trim()) {
      alert('Please enter a slug before publishing.');
      return;
    }

    if (!user) {
      alert('You must be logged in to publish pages.');
      return;
    }

    // Validate slug format (allow slashes for auto-folder creation)
    if (!/^[a-zA-Z0-9_/\-]+$/.test(slug)) {
      alert('Slug must contain only letters, numbers, hyphens, and underscores.');
      return;
    }

    setIsPublishing(true);
    
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ markdown: markdown, slug: slug }),
      });

      if (response.ok) {
        alert('Content published successfully!');
        setPageExists(true); // Page now exists in database
      } else {
        const errorData = await response.json();
        alert(`Failed to publish content: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error publishing content:', error);
      alert('An error occurred while publishing. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!slug.trim()) {
      alert('No page to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${slug}"? It will be moved to trash and can be restored later.`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: slug, action: 'delete' }),
      });

      if (response.ok) {
        alert('Page moved to trash successfully!');
        // Clear the editor and redirect to home
        setMarkdown('');
        setSlug('');
        setPageExists(false);
        router.push('/');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete page: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      alert('An error occurred while deleting. Please try again.');
    }
  };

  const uploadFile = async (file: File, type: 'image' | 'audio' | 'video') => {
    // Validate file type
    if (type === 'image' && !file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    if (type === 'audio' && !['audio/mp3', 'audio/wav', 'audio/mpeg'].includes(file.type)) {
      alert('Please select an MP3 or WAV file.');
      return;
    }

    if (type === 'video' && !['video/mp4', 'video/quicktime', 'image/heic', 'image/heif'].includes(file.type)) {
      alert('Please select an MP4, MOV, or HEIC file.');
      return;
    }

    // Validate file size (10MB for audio/video, 5MB for images)
    const maxSize = type === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`${type === 'image' ? 'Image' : type === 'audio' ? 'Audio' : 'Video'} must be smaller than ${type === 'image' ? '5MB' : '10MB'}.`);
      return;
    }

    // For videos, check duration client-side
    if (type === 'video') {
      try {
        const duration = await getVideoDuration(file);
        if (duration > 30) { // 30 second limit
          alert('Video must be shorter than 30 seconds.');
          return;
        }
      } catch (error) {
        console.error('Error checking video duration:', error);
        alert('Could not verify video duration. Please try again.');
        return;
      }
    }

    setIsUploading(true);

    try {
      let processedFile = file;
      
      // Convert HEIC images to JPEG for web compatibility
      if (type === 'image' && ['image/heic', 'image/heif'].includes(file.type)) {
        processedFile = await convertHeicToJpeg(file);
      }

      // Generate unique filename
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const bucketName = type === 'image' ? 'images' : type === 'audio' ? 'audio' : 'videos';
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, processedFile);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Insert URL into markdown based on type
      let markdownInsert: string;
      if (type === 'image') {
        markdownInsert = `![${file.name}](${publicUrl})`;
      } else if (type === 'audio') {
        markdownInsert = `!audio(${publicUrl})`;
      } else {
        markdownInsert = `!video(${publicUrl})`;
      }
      
      // Insert at cursor position or at the end
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newMarkdown = markdown.substring(0, start) + markdownInsert + markdown.substring(end);
        setMarkdown(newMarkdown);
        
        // Set cursor position after the inserted content
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + markdownInsert.length, start + markdownInsert.length);
        }, 0);
      } else {
        setMarkdown(markdown + '\n' + markdownInsert);
      }

    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      if (error && typeof error === 'object') {
        console.error('Error keys:', Object.keys(error));
        console.error('Error message:', (error as any).message);
        console.error('Error code:', (error as any).code);
        console.error('Error status:', (error as any).status);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload ${type}: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Could not load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Helper function to convert HEIC to JPEG
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      // Dynamically import heic2any to avoid SSR issues
      const heic2any = (await import('heic2any')).default;
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9
      });
      
      // heic2any can return a Blob or Blob[], we need to handle both cases
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      
      const jpegFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      return jpegFile;
    } catch (error) {
      console.error('Error converting HEIC to JPEG:', error);
      throw new Error('Failed to convert HEIC image to JPEG');
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file, 'image');
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file, 'audio');
    }
    // Reset input value to allow selecting the same file again
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file, 'video');
    }
    // Reset input value to allow selecting the same file again
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        uploadFile(file, 'image');
      } else if (['audio/mp3', 'audio/wav', 'audio/mpeg'].includes(file.type)) {
        uploadFile(file, 'audio');
      } else if (['video/mp4', 'video/quicktime', 'image/heic', 'image/heif'].includes(file.type)) {
        uploadFile(file, 'video');
      } else {
        alert('Please drop an image (PNG, JPEG, HEIC), audio file (MP3, WAV), or video file (MP4, MOV, HEIC).');
      }
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Action Buttons - Top Right */}
        <div className="absolute top-6 right-6 z-10 flex space-x-2">
          {pageExists && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-300 transition-all duration-200 shadow-sm text-sm"
            >
              Delete
            </button>
          )}
          <button
            onClick={handlePublish}
            disabled={isPublishing || !markdown.trim() || !slug.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm text-sm"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <Link 
              href="/dashboard"
              className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Editor</h1>
          </div>
          <p className="text-gray-600">Write your content in Markdown and see a live preview</p>
        </div>

        {/* Slug Input with Autocomplete */}
        <div className="mb-6 relative">
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
            Slug
          </label>
          <div className="flex items-center relative">
            <span className="text-gray-500 mr-2">/</span>
            <input
              ref={slugInputRef}
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              onKeyDown={handleSlugKeyDown}
              onFocus={() => slug.trim() && setShowSuggestions(true)}
              placeholder="Enter slug (e.g., about-me, contact)"
              autoComplete="off"
              className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            {isLoadingContent && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Use letters, numbers, hyphens, and underscores. This will be your page URL.
          </p>

          {/* Suggestions Dropdown */}
          {showSuggestions && slugSuggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              {slugSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.slug}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                    index === selectedSuggestionIndex ? 'bg-blue-50 text-blue-900' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm">/{suggestion.slug}</div>
                    <div className="text-xs text-gray-500">
                      📄 Page
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Created: {new Date(suggestion.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-300px)]">
          {/* Editor Column */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Editor</h2>
                <div className="flex items-center space-x-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.wav"
                    onChange={handleAudioSelect}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? 'Uploading...' : 'Image'}
                  </button>
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? 'Uploading...' : 'Audio'}
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? 'Uploading...' : 'Video'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                placeholder="Write your Markdown content here... Drag and drop images, audio, or video files here or use the upload buttons above."
                className={`w-full h-full min-h-[500px] p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm ${
                  dragActive ? 'border-blue-500 bg-blue-50' : ''
                }`}
              />
            </div>
          </div>

          {/* Preview Column */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            </div>
            <div className="p-4 h-full overflow-y-auto">
              {markdown ? (
                <div className="prose prose-sm max-w-none">
                  <CustomMarkdown>{markdown}</CustomMarkdown>
                </div>
              ) : (
                <div className="text-gray-500 italic text-center py-8">
                  Start typing in the editor to see the preview here...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
} 