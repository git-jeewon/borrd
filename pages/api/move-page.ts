import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pageId, slug, folderId } = req.body;

    if (!pageId && !slug) {
      return res.status(400).json({ error: 'Page ID or slug is required' });
    }

    // Validate folderId exists if provided (null means uncategorized)
    if (folderId && typeof folderId === 'number') {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .single();

      if (folderError || !folder) {
        return res.status(400).json({ error: 'Target folder does not exist' });
      }
    }

    // Get current page info
    const pageQuery = pageId 
      ? supabase.from('pages').select('id, slug').eq('id', pageId)
      : supabase.from('pages').select('id, slug').eq('slug', slug);

    const { data: currentPage, error: pageError } = await pageQuery.single();

    if (pageError || !currentPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Update the page's folder_id
    const { error: updateError } = await supabase
      .from('pages')
      .update({ 
        folder_id: folderId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPage.id);

    if (updateError) {
      console.error('Error updating page:', updateError);
      return res.status(500).json({ error: 'Failed to move page' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 