-- Create the storage buckets (skip if they already exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for videos (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Public uploads for videos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Images" ON storage.objects;
DROP POLICY IF EXISTS "Public uploads for images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Audio" ON storage.objects;
DROP POLICY IF EXISTS "Public uploads for audio" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Authenticated users can upload videos" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "Public uploads for videos" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'videos');

-- Storage policies for images  
CREATE POLICY "Public Access Images" ON storage.objects 
FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Public uploads for images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'images');

-- Storage policies for audio
CREATE POLICY "Public Access Audio" ON storage.objects 
FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "Public uploads for audio" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'audio');

-- Drop existing tables and functions to start fresh
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP FUNCTION IF EXISTS generate_folder_path() CASCADE;
DROP FUNCTION IF EXISTS generate_page_path() CASCADE;

-- Hierarchical folders table (for dashboard organization only, no URL generation)
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, -- Display name for the folder
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE, -- Hierarchical structure
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure name is reasonable
  CONSTRAINT valid_folder_name CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 100)
);

-- Pages table with flat slugs and optional folder organization
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, -- Flat, unique slug (e.g., "about", "field-notes")
  markdown TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL, -- Optional folder for organization only
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure slug is valid for URLs and unique
  CONSTRAINT valid_page_slug CHECK (slug ~ '^[a-zA-Z0-9_-]+$' AND LENGTH(slug) > 0)
);

-- Create indexes for performance
CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_folder_id ON pages(folder_id);
CREATE INDEX idx_pages_deleted_at ON pages(deleted_at);
CREATE INDEX idx_folders_name ON folders(name);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- Sample hierarchical folder data
INSERT INTO folders (name, parent_id) VALUES ('Projects', NULL);  -- id = 1
INSERT INTO folders (name, parent_id) VALUES ('Notes', NULL);     -- id = 2
INSERT INTO folders (name, parent_id) VALUES ('Ideas', NULL);     -- id = 3
INSERT INTO folders (name, parent_id) VALUES ('Web Projects', 1); -- id = 4, child of Projects
INSERT INTO folders (name, parent_id) VALUES ('Mobile Apps', 1);  -- id = 5, child of Projects

-- Sample pages with flat slugs (note: folder_id corresponds to folder IDs above)
INSERT INTO pages (slug, markdown, folder_id) VALUES 
  ('about', '# About\n\nThis is the about page.', NULL),
  ('contact', '# Contact\n\nGet in touch with me.', NULL),
  ('field-notes', '# Field Notes\n\nMy observations and thoughts.', 2),
  ('project-alpha', '# Project Alpha\n\nDetails about this project.', 4),
  ('mobile-app-beta', '# Mobile App Beta\n\nMy mobile app project.', 5),
  ('random-thoughts', '# Random Thoughts\n\nJust some ideas.', 3); 