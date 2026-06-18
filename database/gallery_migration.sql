-- Gallery images table
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS gallery_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url           text NOT NULL,
  public_id     text NOT NULL,  -- Cloudinary public_id needed for deletion
  alt_text      text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_order ON gallery_images (display_order ASC);
