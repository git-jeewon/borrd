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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { markdown, slug, folderId } = req.body;

    // Validate the request body
    if (!markdown || typeof markdown !== 'string') {
      return res.status(400).json({ error: 'markdown field is required and must be a string' });
    }

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'slug field is required and must be a string' });
    }

    // Validate slug format
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return res.status(400).json({ error: 'slug must contain only letters, numbers, hyphens, and underscores' });
    }

    // Validate folderId if provided (must belong to user)
    if (folderId && typeof folderId === 'number') {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folder) {
        return res.status(400).json({ error: 'Invalid folder ID' });
      }
    }

    // Check if a page with this slug already exists for this user
    const { data: existingPage, error: fetchError } = await supabase
      .from('pages')
      .select('id, slug')
      .eq('slug', slug)
      .eq('user_id', user.id)
      .single();

    if (existingPage && !fetchError) {
      // Page exists - update it
      const { error: updateError } = await supabase
        .from('pages')
        .update({
          markdown,
          folder_id: folderId || null,
          updated_at: new Date().toISOString()
        })
        .eq('slug', slug);

      if (updateError) {
        console.error('Error updating page:', updateError);
        return res.status(500).json({ error: 'Failed to update page' });
      }

      return res.status(200).json({ 
        success: true, 
        action: 'updated',
        slug 
      });
    }

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Some other error occurred
      console.error('Error checking existing page:', fetchError);
      return res.status(500).json({ error: 'Failed to check existing page' });
    }

    // Page doesn't exist - create it
    const { error: insertError } = await supabase
      .from('pages')
      .insert({
        slug,
        markdown,
        folder_id: folderId || null,
        user_id: user.id
      });

    if (insertError) {
      console.error('Error creating page:', insertError);
      return res.status(500).json({ error: 'Failed to create page' });
    }

    return res.status(201).json({ 
      success: true, 
      action: 'created',
      slug 
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 