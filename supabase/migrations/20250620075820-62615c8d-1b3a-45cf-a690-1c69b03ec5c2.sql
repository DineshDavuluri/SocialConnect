
-- First, let's ensure proper RLS policies exist for all messaging tables
-- Drop existing policies if they exist and recreate them properly

-- Messages table policies
DROP POLICY IF EXISTS "Users can view their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can view their conversations" ON messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid()) 
    AND deleted_for_everyone = false
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() 
    AND can_send_message(auth.uid(), receiver_id)
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Post shares table policies
DROP POLICY IF EXISTS "Users can view shared posts in their conversations" ON post_shares;
DROP POLICY IF EXISTS "Users can share posts" ON post_shares;

CREATE POLICY "Users can view shared posts in their conversations" ON post_shares
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can share posts" ON post_shares
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Message reactions policies
DROP POLICY IF EXISTS "Users can view reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;

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

-- Follows table policies for conversation list
DROP POLICY IF EXISTS "Users can view their follows" ON follows;
DROP POLICY IF EXISTS "Users can manage their follows" ON follows;

CREATE POLICY "Users can view their follows" ON follows
  FOR SELECT USING (
    follower_id = auth.uid() OR following_id = auth.uid()
  );

CREATE POLICY "Users can manage their follows" ON follows
  FOR ALL USING (follower_id = auth.uid());

-- Users table policies for profile data
DROP POLICY IF EXISTS "Users can view public profiles" ON users;

CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (true);
