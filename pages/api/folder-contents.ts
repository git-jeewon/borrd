import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { folderId } = req.query;

    if (folderId && typeof folderId === 'string') {
      // Get specific folder contents
      const folderIdNum = parseInt(folderId, 10);
      if (isNaN(folderIdNum)) {
        return res.status(400).json({ error: 'Invalid folder ID' });
      }

      // Get folder info
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderIdNum)
        .single();

      if (folderError || !folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      // Get direct subfolders
      const { data: subfolders, error: subfoldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('parent_id', folderIdNum)
        .order('name');

      if (subfoldersError) {
        console.error('Error fetching subfolders:', subfoldersError);
        return res.status(500).json({ error: 'Failed to fetch subfolders' });
      }

      // Get pages in this folder
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('id, slug, created_at, updated_at')
        .eq('folder_id', folderIdNum)
        .is('deleted_at', null)
        .order('slug');

      if (pagesError) {
        console.error('Error fetching pages:', pagesError);
        return res.status(500).json({ error: 'Failed to fetch pages' });
      }

      return res.status(200).json({
        folder,
        subfolders: subfolders || [],
        pages: pages || []
      });
    }

    // Get all folders and root-level data for dashboard
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .order('name');

    if (foldersError) {
      console.error('Error fetching folders:', foldersError);
      return res.status(500).json({ error: 'Failed to fetch folders' });
    }

    // Get uncategorized pages (no folder_id)
    const { data: uncategorizedPages, error: pagesError } = await supabase
      .from('pages')
      .select('id, slug, created_at, updated_at')
      .is('folder_id', null)
      .is('deleted_at', null)
      .order('slug');

    if (pagesError) {
      console.error('Error fetching uncategorized pages:', pagesError);
      return res.status(500).json({ error: 'Failed to fetch pages' });
    }

    return res.status(200).json({
      folders: folders || [],
      uncategorizedPages: uncategorizedPages || []
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 