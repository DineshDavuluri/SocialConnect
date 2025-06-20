
-- Fix the self-referencing foreign key for reply_to in messages table
-- Drop the existing foreign key constraint if it exists
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reply_to_fkey;

-- Recreate the foreign key constraint properly
ALTER TABLE messages 
ADD CONSTRAINT messages_reply_to_fkey 
FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL;

-- Create proper index for the reply_to column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);

-- Ensure RLS is enabled on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
