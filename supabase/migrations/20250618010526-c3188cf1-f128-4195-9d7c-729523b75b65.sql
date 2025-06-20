
-- Add missing reply_to column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Create index for better performance on reply_to queries
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);

-- Update RLS policies for messages table
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can view their conversations" ON messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Enable RLS on messages table if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for posts table to allow editing and deleting
DROP POLICY IF EXISTS "Users can view public posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

CREATE POLICY "Users can view public posts" ON posts
  FOR SELECT USING (is_public = true AND (is_deleted = false OR is_deleted IS NULL));

CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own posts" ON posts
  FOR UPDATE USING (user_id = auth.uid());

-- Enable RLS on posts table if not already enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for post_shares table
DROP POLICY IF EXISTS "Users can view their own shared posts" ON post_shares;
DROP POLICY IF EXISTS "Users can share posts" ON post_shares;

CREATE POLICY "Users can view their own shared posts" ON post_shares
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can share posts" ON post_shares
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Enable RLS on post_shares table if not already enabled
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;
