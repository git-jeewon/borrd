# Borrd - Markdown Editor

A Next.js application with a Markdown editor that saves content to Supabase and displays it with customizable styling using slugs. Includes image and audio upload support via Supabase Storage.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Set up your Supabase database with a `pages` table:
```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  markdown TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

4. Set up Supabase Storage for file uploads:
   - Go to your Supabase dashboard → Storage
   - Create two buckets: `images` and `audio`
   - Set both buckets to public (anyone can view)
   - Set the bucket policies to allow public uploads:
```sql
-- Allow public uploads to images bucket
CREATE POLICY "Allow public image uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images');

-- Allow public access to view images
CREATE POLICY "Allow public image viewing" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

-- Allow public uploads to audio bucket
CREATE POLICY "Allow public audio uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio');

-- Allow public access to view audio
CREATE POLICY "Allow public audio viewing" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio');
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to view your published pages
7. Open [http://localhost:3000/editor](http://localhost:3000/editor) to create new pages

## Features

- Live Markdown preview in the editor
- Save content to Supabase with unique slugs
- Display published content at `/[slug]` URLs
- **Image upload support** via Supabase Storage
  - Drag and drop images into the editor
  - Click upload button to select images
  - Automatic Markdown insertion with public URLs
  - File type validation (images only)
  - 5MB file size limit
- **Audio upload support** via Supabase Storage
  - Upload MP3 and WAV files
  - Custom audio player with waveform visualization
  - Play/pause functionality with minimal controls
  - 10MB file size limit
- **Video upload support** via Supabase Storage
  - Upload MP4 videos
  - Max size: 10MB
  - Max duration: 30 seconds
  - Inserted as: `!video(url)`
  - Features: Autoplay, muted, loop, no controls, rounded corners
- Frontmatter support for styling:
  - `font`: Set to `serif`, `sans`, or `mono` to change the font family
  - `background`: Set to a hex color code (e.g., `#f0f0f0`) to change the background color
- Responsive design with Tailwind CSS
- TypeScript support

## Usage

### Editor Features

- **Markdown Editing**: Write content using standard Markdown syntax
- **Live Preview**: See your content rendered in real-time
- **Slug Management**: Create unique URLs for your pages with autocomplete
- **Image Upload**: Drag and drop or click to upload images (PNG, JPEG, HEIC)
- **Audio Upload**: Upload audio files (MP3, WAV) with waveform player
- **Video Upload**: Upload short videos (MP4, max 30 seconds) with autoplay

### Media Upload

**Images:**
- Supported formats: PNG, JPEG, HEIC
- Max size: 5MB
- Inserted as: `![filename](url)`

**Audio:**
- Supported formats: MP3, WAV
- Max size: 10MB
- Inserted as: `!audio(url)`
- Features: Waveform visualization, play/pause controls

**Videos:**
- Supported formats: MP4
- Max size: 10MB
- Max duration: 30 seconds
- Inserted as: `!video(url)`
- Features: Autoplay, muted, loop, no controls, rounded corners

### Step-by-Step Usage

1. **Create a page**: Go to `/editor` and enter a slug (e.g., `about-me`, `field-notes`)
2. **Write content**: Use Markdown with optional frontmatter for styling
3. **Upload media**: Drag and drop images/audio/video or use the upload buttons
4. **Publish**: Click the publish button to save to the database
5. **View**: Your page will be available at `/[slug]` (e.g., `/about-me`)

## Frontmatter Example

You can add frontmatter to your Markdown content to customize the styling:

```markdown
---
font: serif
background: "#f8f9fa"
---

# Your Content Here

This content will be displayed with a serif font and a light gray background.

![My Image](https://your-project.supabase.co/storage/v1/object/public/images/1234567890-abc123.jpg)

!audio(https://your-project.supabase.co/storage/v1/object/public/audio/1234567890-def456.mp3)
```

## API Endpoints

- `POST /api/publish` - Saves Markdown content to the database with a slug
- `GET /` - Lists all published pages
- `GET /[slug]` - Displays a specific page with styling based on frontmatter

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key (for client-side operations like file uploads)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)

## Supabase Setup

1. Create a new Supabase project
2. Create the following storage buckets:
   - `images` (public)
   - `audio` (public) 
   - `videos` (public)

3. Set up storage policies for each bucket:

**For `images` bucket:**
```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Allow public uploads (for client-side uploads)
CREATE POLICY "Public uploads for images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
```

**For `audio` bucket:**
```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'audio');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio' AND auth.role() = 'authenticated');

-- Allow public uploads (for client-side uploads)
CREATE POLICY "Public uploads for audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio');
```

**For `videos` bucket:**
```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'videos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

-- Allow public uploads (for client-side uploads)
CREATE POLICY "Public uploads for videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos');
``` 