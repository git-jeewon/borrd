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
    const { format = 'json', includeDeleted = 'false' } = req.query;

    // Fetch all pages (active and optionally deleted)
    let query = supabase
      .from('pages')
      .select('id, slug, markdown, folder, created_at, updated_at, deleted_at')
      .order('created_at', { ascending: false });

    // Filter out deleted pages unless specifically requested
    if (includeDeleted !== 'true') {
      query = query.is('deleted_at', null);
    }

    const { data: pages, error: pagesError } = await query;

    if (pagesError) {
      console.error('Error fetching pages for export:', pagesError);
      return res.status(500).json({ error: 'Failed to fetch pages' });
    }

    // Fetch folders for context
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .order('name');

    if (foldersError) {
      console.error('Error fetching folders for export:', foldersError);
    }

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalPages: pages?.length || 0,
        includesDeleted: includeDeleted === 'true',
        format: format
      },
      folders: folders || [],
      pages: pages || []
    };

    // Set appropriate headers for file download
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `borrd-export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.status(200).json(exportData);

  } catch (error) {
    console.error('Unexpected error during export:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 