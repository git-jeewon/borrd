import { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to get user from session token in API routes
export async function getAuthenticatedUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

// Helper function to get user from session in server-side context
export async function getUserFromSession(sessionToken: string) {
  if (!sessionToken) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
  
  if (error || !user) return null;
  return user;
}

export { supabase }; 