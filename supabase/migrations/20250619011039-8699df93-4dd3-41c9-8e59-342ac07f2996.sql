
-- Add missing columns for enhanced privacy and notification settings
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
  "private_account": false,
  "show_activity_status": true,
  "allow_story_mentions": true,
  "allow_message_requests": true,
  "hide_last_seen": false
}'::jsonb,
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "likes_comments": true,
  "new_followers": true,
  "direct_messages": true,
  "story_views": false,
  "post_shares": true,
  "message_reactions": true
}'::jsonb;

-- Create message reactions table for enhanced messaging
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;

-- RLS policies for message_reactions
CREATE POLICY "Users can view reactions on their conversations" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m 
      WHERE m.id = message_id 
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions" ON message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Add delete for everyone functionality to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMP WITH TIME ZONE;

-- Drop existing notification policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Update RLS policies for messages to respect privacy settings
DROP POLICY IF EXISTS "Users can view their conversations" ON messages;

CREATE POLICY "Users can view their conversations" ON messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid()) 
    AND deleted_for_everyone = false
  );

-- Create function to check if user allows message requests
CREATE OR REPLACE FUNCTION can_send_message(sender_uuid uuid, receiver_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  receiver_settings jsonb;
  is_following boolean;
BEGIN
  -- Get receiver's privacy settings
  SELECT privacy_settings INTO receiver_settings
  FROM users WHERE id = receiver_uuid;
  
  -- Check if sender is following receiver
  SELECT EXISTS(
    SELECT 1 FROM follows 
    WHERE follower_id = sender_uuid AND following_id = receiver_uuid
  ) INTO is_following;
  
  -- Allow if following or if receiver allows message requests
  RETURN is_following OR COALESCE((receiver_settings->>'allow_message_requests')::boolean, true);
END;
$$;

-- Update message insert policy to respect privacy settings
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() 
    AND can_send_message(auth.uid(), receiver_id)
  );
