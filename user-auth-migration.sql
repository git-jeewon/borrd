-- Add user authentication and page ownership
-- This migration adds user_id field to pages table and sets up proper constraints

-- Add user_id column to pages table
ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for performance when filtering by user
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);

-- Add index for user + slug combination (for user-specific slug uniqueness)
CREATE INDEX IF NOT EXISTS idx_pages_user_slug ON pages(user_id, slug);

-- Add comment to explain the field
COMMENT ON COLUMN pages.user_id IS 'References the user who owns this page';

-- Update the slug constraint to allow same slug for different users
-- First drop the old unique constraint
ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_key;

-- Add new unique constraint for user_id + slug combination
ALTER TABLE pages ADD CONSTRAINT unique_user_slug UNIQUE (user_id, slug);

-- Optional: If you want to assign existing pages to a specific user, uncomment and modify:
-- UPDATE pages SET user_id = 'your-user-uuid-here' WHERE user_id IS NULL;

-- Make user_id required for new pages (after updating existing ones)
-- ALTER TABLE pages ALTER COLUMN user_id SET NOT NULL; 