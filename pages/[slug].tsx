import React from 'react';
import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import CustomMarkdown from '../components/CustomMarkdown';
import matter from 'gray-matter';

interface PageData {
  id: number;
  slug: string;
  markdown: string;
  created_at?: string;
  updated_at?: string;
}

interface Frontmatter {
  font?: 'serif' | 'sans' | 'mono';
  background?: string;
  [key: string]: any;
}

interface SlugPageProps {
  content: string;
  frontmatter: Frontmatter;
  slug: string;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<SlugPageProps> = async ({ params }) => {
  try {
    const slug = params?.slug as string;

    if (!slug) {
      return {
        notFound: true
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        props: {
          content: '',
          frontmatter: {},
          slug,
          error: 'Supabase configuration missing'
        }
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the page with the given slug
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching page:', error);
      return {
        notFound: true
      };
    }

    if (!page) {
      return {
        notFound: true
      };
    }

    // Parse frontmatter from the markdown content
    const { data: frontmatter, content } = matter(page.markdown);

    return {
      props: {
        content,
        frontmatter: frontmatter as Frontmatter,
        slug
      }
    };

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      notFound: true
    };
  }
};

export default function SlugPage({ content, frontmatter, slug, error }: SlugPageProps) {
  // Determine font class based on frontmatter
  const getFontClass = () => {
    switch (frontmatter.font) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  // Determine background style
  const getBackgroundStyle = () => {
    if (frontmatter.background && /^#[0-9A-F]{6}$/i.test(frontmatter.background)) {
      return { backgroundColor: frontmatter.background };
    }
    return {};
  };

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

  return (
    <div 
      className={`min-h-screen ${getFontClass()}`}
      style={getBackgroundStyle()}
    >
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-lg max-w-none">
          <CustomMarkdown>{content}</CustomMarkdown>
        </div>
      </div>
    </div>
  );
} 