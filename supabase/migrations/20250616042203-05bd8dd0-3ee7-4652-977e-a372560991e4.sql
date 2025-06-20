
-- Create saved_posts table for bookmarking posts
CREATE TABLE public.saved_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS for saved_posts
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_posts
CREATE POLICY "Users can view their own saved posts" 
  ON public.saved_posts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts" 
  ON public.saved_posts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove saved posts" 
  ON public.saved_posts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  views_count INTEGER DEFAULT 0
);

-- Enable RLS for stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Create policies for stories
CREATE POLICY "Users can view non-expired stories" 
  ON public.stories 
  FOR SELECT 
  USING (expires_at > now());

CREATE POLICY "Users can create their own stories" 
  ON public.stories 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories" 
  ON public.stories 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories" 
  ON public.stories 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add parent_id to comments table for nested replies
ALTER TABLE public.comments 
ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Add saved_count to posts table
ALTER TABLE public.posts 
ADD COLUMN saved_count INTEGER DEFAULT 0;

-- Create function to update story views
CREATE OR REPLACE FUNCTION public.increment_story_views(story_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stories 
  SET views_count = views_count + 1 
  WHERE id = story_id;
END;
$$;

-- Enable realtime for new tables
ALTER TABLE public.saved_posts REPLICA IDENTITY FULL;
ALTER TABLE public.stories REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
