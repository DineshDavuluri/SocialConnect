
-- First, let's update the notification type enum to include 'message' and 'story' types
ALTER TYPE notification_type ADD VALUE 'message';
ALTER TYPE notification_type ADD VALUE 'story';

-- Create a function to automatically create notifications when messages are sent
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if sender and receiver are different
  IF NEW.sender_id != NEW.receiver_id THEN
    INSERT INTO notifications (
      user_id,
      actor_id,
      type,
      message
    ) VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'message',
      'sent you a message'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message notifications
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();

-- Create a function to automatically create notifications when stories are posted
CREATE OR REPLACE FUNCTION create_story_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notifications for all followers when a story is posted
  INSERT INTO notifications (user_id, actor_id, type, message)
  SELECT 
    f.follower_id,
    NEW.user_id,
    'story',
    'posted a new story'
  FROM follows f
  WHERE f.following_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for story notifications
CREATE TRIGGER story_notification_trigger
  AFTER INSERT ON stories
  FOR EACH ROW
  EXECUTE FUNCTION create_story_notification();

-- Update stories table to ensure better support for multimedia content
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS music_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';
