import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser, supabase } from '../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pageId, slug } = req.query;

    if (!pageId && !slug) {
      return res.status(400).json({ error: 'Page ID or slug is required' });
    }

    // Get the page to be deleted
    const pageQuery = pageId 
      ? supabase.from('pages').select('id, slug, folder_id').eq('id', pageId as string)
      : supabase.from('pages').select('id, slug, folder_id').eq('slug', slug as string);

    const { data: page, error: fetchError } = await pageQuery.single();

    if (fetchError || !page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Soft delete the page by setting deleted_at
    const { error: deleteError } = await supabase
      .from('pages')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', page.id);

    if (deleteError) {
      console.error('Error deleting page:', deleteError);
      return res.status(500).json({ error: 'Failed to delete page' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 