
-- Add profile_picture_url to users table if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create follows table for following/followers system
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Enable RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Create policies for follows
CREATE POLICY "Users can view all follows" 
  ON public.follows 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others" 
  ON public.follows 
  FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" 
  ON public.follows 
  FOR DELETE 
  USING (auth.uid() = follower_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'message', 'story')),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Update stories table to only show following users' stories
DROP POLICY IF EXISTS "Users can view non-expired stories" ON public.stories;

CREATE POLICY "Users can view following users' non-expired stories" 
  ON public.stories 
  FOR SELECT 
  USING (
    expires_at > now() AND (
      user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.follows 
        WHERE follower_id = auth.uid() AND following_id = user_id
      )
    )
  );

-- Add media_type constraint to stories (image or video only)
ALTER TABLE public.stories 
DROP CONSTRAINT IF EXISTS stories_media_type_check;

ALTER TABLE public.stories 
ADD CONSTRAINT stories_media_type_check 
CHECK (media_type IN ('image', 'video'));

-- Add story_data column for stickers, music, etc.
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS story_data JSONB DEFAULT '{}';

-- Enable realtime for new tables
ALTER TABLE public.follows REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to update user counts
CREATE OR REPLACE FUNCTION public.update_user_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update followers count
  IF TG_TABLE_NAME = 'follows' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.users 
      SET followers_count = (
        SELECT COUNT(*) FROM public.follows WHERE following_id = NEW.following_id
      )
      WHERE id = NEW.following_id;
      
      UPDATE public.users 
      SET following_count = (
        SELECT COUNT(*) FROM public.follows WHERE follower_id = NEW.follower_id
      )
      WHERE id = NEW.follower_id;
      
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.users 
      SET followers_count = (
        SELECT COUNT(*) FROM public.follows WHERE following_id = OLD.following_id
      )
      WHERE id = OLD.following_id;
      
      UPDATE public.users 
      SET following_count = (
        SELECT COUNT(*) FROM public.follows WHERE follower_id = OLD.follower_id
      )
      WHERE id = OLD.follower_id;
      
      RETURN OLD;
    END IF;
  END IF;
  
  -- Update posts count
  IF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.users 
      SET posts_count = (
        SELECT COUNT(*) FROM public.posts WHERE user_id = NEW.user_id
      )
      WHERE id = NEW.user_id;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.users 
      SET posts_count = (
        SELECT COUNT(*) FROM public.posts WHERE user_id = OLD.user_id
      )
      WHERE id = OLD.user_id;
      RETURN OLD;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers for count updates
DROP TRIGGER IF EXISTS follows_count_trigger ON public.follows;
CREATE TRIGGER follows_count_trigger
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_user_counts();

DROP TRIGGER IF EXISTS posts_count_trigger ON public.posts;
CREATE TRIGGER posts_count_trigger
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_counts();
