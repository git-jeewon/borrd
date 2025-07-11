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
    const debug: any = {};

    // Check if folders table exists and what data it contains
    try {
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .order('path');

      debug.folders = {
        exists: !foldersError,
        error: foldersError?.message,
        count: folders?.length || 0,
        data: folders || []
      };
    } catch (error) {
      debug.folders = {
        exists: false,
        error: (error as any)?.message,
        count: 0,
        data: []
      };
    }

    // Check if pages table exists and what data it contains
    try {
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('id, slug, path, folder_path, deleted_at')
        .order('created_at', { ascending: false });

      debug.pages = {
        exists: !pagesError,
        error: pagesError?.message,
        count: pages?.length || 0,
        activePagesCount: pages?.filter(p => !p.deleted_at).length || 0,
        data: pages || []
      };
    } catch (error) {
      debug.pages = {
        exists: false,
        error: (error as any)?.message,
        count: 0,
        data: []
      };
    }

    // Check table schemas
    try {
      const { data: foldersSchema, error: foldersSchemaError } = await supabase
        .rpc('get_table_columns', { table_name: 'folders' });

      debug.foldersSchema = {
        error: foldersSchemaError?.message,
        columns: foldersSchema || []
      };
    } catch (error) {
      debug.foldersSchema = {
        error: 'Could not get folders schema',
        columns: []
      };
    }

    try {
      const { data: pagesSchema, error: pagesSchemaError } = await supabase
        .rpc('get_table_columns', { table_name: 'pages' });

      debug.pagesSchema = {
        error: pagesSchemaError?.message,
        columns: pagesSchema || []
      };
    } catch (error) {
      debug.pagesSchema = {
        error: 'Could not get pages schema',
        columns: []
      };
    }

    // Test creating a sample folder
    try {
      const testFolderName = `test-${Date.now()}`;
      
      const { data: createResult, error: createError } = await supabase
        .from('folders')
        .insert({ name: testFolderName })
        .select();

      if (createError) {
        debug.testCreateFolder = {
          success: false,
          error: createError.message
        };
      } else {
        debug.testCreateFolder = {
          success: true,
          data: createResult
        };

        // Clean up test folder
        await supabase
          .from('folders')
          .delete()
          .eq('name', testFolderName);
      }
    } catch (error) {
      debug.testCreateFolder = {
        success: false,
        error: (error as any)?.message
      };
    }

    return res.status(200).json(debug);

  } catch (error) {
    console.error('Debug API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: (error as any)?.message 
    });
  }
} 