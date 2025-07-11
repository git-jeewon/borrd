import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET':
        // List all folders in hierarchical structure
        const { data: folders, error: fetchError } = await supabase
          .from('folders')
          .select('*')
          .order('name');

        if (fetchError) {
          console.error('Error fetching folders:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch folders' });
        }

        return res.status(200).json({ folders: folders || [] });

      case 'POST':
        // Create a new top-level folder
        const { name } = req.body;

        if (!name || typeof name !== 'string') {
          return res.status(400).json({ error: 'Folder name is required' });
        }

        // Validate folder name
        if (!/^[a-zA-Z0-9_\s-]+$/.test(name)) {
          return res.status(400).json({ 
            error: 'Folder name must contain only letters, numbers, spaces, hyphens, and underscores' 
          });
        }

        // Check if folder with this name already exists at the top level
        // Since we only create top-level folders now, parent_id is always null
        const { data: existingFolder, error: checkError } = await supabase
          .from('folders')
          .select('id')
          .eq('name', name.trim())
          .is('parent_id', null)
          .single();

        // PGRST116 means "no rows returned" which is expected when no folder exists
        // Any other error or if a folder is found, we need to handle it
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking folder existence:', checkError);
          console.error('Error code:', checkError.code);
          console.error('Error message:', checkError.message);
          return res.status(500).json({ error: 'Failed to check folder existence' });
        }

        if (existingFolder) {
          return res.status(400).json({ error: 'Folder with this name already exists' });
        }

        // Create the folder (always top-level, so parent_id is null)
        const { data: newFolder, error: insertError } = await supabase
          .from('folders')
          .insert({ 
            name: name.trim(),
            parent_id: null
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating folder:', insertError);
          return res.status(500).json({ error: 'Failed to create folder' });
        }

        return res.status(201).json({ success: true, folder: newFolder });

      case 'DELETE':
        // Delete a folder (move its pages to uncategorized, and move subfolders to parent)
        const { folderId } = req.query;

        if (!folderId || typeof folderId !== 'string') {
          return res.status(400).json({ error: 'Folder ID is required' });
        }

        const folderIdNum = parseInt(folderId, 10);
        if (isNaN(folderIdNum)) {
          return res.status(400).json({ error: 'Invalid folder ID' });
        }

        // Check if folder exists and get parent info
        const { data: folderToDelete, error: folderError } = await supabase
          .from('folders')
          .select('id, name, parent_id')
          .eq('id', folderIdNum)
          .single();

        if (folderError || !folderToDelete) {
          return res.status(404).json({ error: 'Folder not found' });
        }

        // Move all pages in this folder to uncategorized (null folder_id)
        const { error: updatePagesError } = await supabase
          .from('pages')
          .update({ folder_id: null })
          .eq('folder_id', folderIdNum);

        if (updatePagesError) {
          console.error('Error updating pages:', updatePagesError);
          return res.status(500).json({ error: 'Failed to update pages' });
        }

        // Move all subfolders to the parent folder (or root if no parent)
        const { error: updateSubfoldersError } = await supabase
          .from('folders')
          .update({ parent_id: folderToDelete.parent_id })
          .eq('parent_id', folderIdNum);

        if (updateSubfoldersError) {
          console.error('Error updating subfolders:', updateSubfoldersError);
          return res.status(500).json({ error: 'Failed to update subfolders' });
        }

        // Delete the folder
        const { error: deleteError } = await supabase
          .from('folders')
          .delete()
          .eq('id', folderIdNum);

        if (deleteError) {
          console.error('Error deleting folder:', deleteError);
          return res.status(500).json({ error: 'Failed to delete folder' });
        }

        return res.status(200).json({ success: true });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 