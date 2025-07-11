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
    const { folderId, targetParentId } = req.body;

    if (!folderId || typeof folderId !== 'number') {
      return res.status(400).json({ error: 'Folder ID is required' });
    }

    // Validate targetParentId if provided (null means move to root)
    if (targetParentId && typeof targetParentId === 'number') {
      // Check if target parent exists
      const { data: targetParent, error: targetError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', targetParentId)
        .single();

      if (targetError || !targetParent) {
        return res.status(400).json({ error: 'Target parent folder does not exist' });
      }

      // Prevent moving a folder into itself or its descendants
      const { data: folderToMove, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .single();

      if (folderError || !folderToMove) {
        return res.status(404).json({ error: 'Folder to move not found' });
      }

      // Check if targetParentId would create a circular reference
      if (await isDescendant(targetParentId, folderId)) {
        return res.status(400).json({ error: 'Cannot move a folder into itself or its descendants' });
      }
    }

    // Check if a folder with the same name already exists in the target location
    const { data: folderToMove, error: fetchError } = await supabase
      .from('folders')
      .select('name')
      .eq('id', folderId)
      .single();

    if (fetchError || !folderToMove) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id')
      .eq('name', folderToMove.name)
      .eq('parent_id', targetParentId || null)
      .neq('id', folderId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for name conflicts:', checkError);
      return res.status(500).json({ error: 'Failed to check for conflicts' });
    }

    if (existingFolder) {
      return res.status(400).json({ error: 'A folder with this name already exists in the target location' });
    }

    // Move the folder
    const { error: updateError } = await supabase
      .from('folders')
      .update({ 
        parent_id: targetParentId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId);

    if (updateError) {
      console.error('Error moving folder:', updateError);
      return res.status(500).json({ error: 'Failed to move folder' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to check if targetId is a descendant of folderId
async function isDescendant(targetId: number, folderId: number): Promise<boolean> {
  const { data: descendants, error } = await supabase
    .from('folders')
    .select('id, parent_id');

  if (error) {
    console.error('Error checking descendants:', error);
    return false;
  }

  // Build a map of parent-child relationships
  const parentMap = new Map<number, number[]>();
  descendants?.forEach(folder => {
    if (folder.parent_id) {
      if (!parentMap.has(folder.parent_id)) {
        parentMap.set(folder.parent_id, []);
      }
      parentMap.get(folder.parent_id)!.push(folder.id);
    }
  });

  // Recursively check if targetId is a descendant of folderId
  function checkDescendant(currentId: number): boolean {
    if (currentId === targetId) return true;
    
    const children = parentMap.get(currentId) || [];
    return children.some(childId => checkDescendant(childId));
  }

  return checkDescendant(folderId);
} 