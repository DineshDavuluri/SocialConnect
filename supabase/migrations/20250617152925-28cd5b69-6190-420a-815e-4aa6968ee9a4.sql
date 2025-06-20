
-- Add privacy settings to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
  "private_account": false,
  "show_activity_status": true,
  "allow_story_mentions": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "likes_comments": true,
  "new_followers": true,
  "direct_messages": true,
  "story_views": false
}'::jsonb;

-- Add edit functionality to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add edit/delete functionality to posts
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create a table for post shares via messages
CREATE TABLE IF NOT EXISTS post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for post_shares
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

-- RLS policies for post_shares
CREATE POLICY "Users can view their own shared posts" ON post_shares
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can share posts" ON post_shares
  FOR INSERT WITH CHECK (sender_id = auth.uid());
