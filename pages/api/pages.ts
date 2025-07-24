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

  try {
    switch (req.method) {
      case 'GET':
        // Fetch all pages for the authenticated user
        const { data: pages, error: pagesError } = await supabase
          .from('pages')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        // Fetch deleted pages for the authenticated user
        const { data: deletedPages, error: deletedError } = await supabase
          .from('pages')
          .select('*')
          .eq('user_id', user.id)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (pagesError || deletedError) {
          console.error('Error fetching pages:', { pagesError, deletedError });
          return res.status(500).json({ error: 'Failed to fetch pages' });
        }

        return res.status(200).json({ 
          pages: pages || [],
          deletedPages: deletedPages || []
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 