
import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import CreateStory from './CreateStory';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
  expires_at: string;
  users: {
    username: string;
    profile_picture_url: string;
  };
}

const StoriesBar = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data } = await supabase
        .from('stories')
        .select(`
          *,
          users (
            username,
            profile_picture_url
          )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      setStories(data || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  return (
    <div className="flex space-x-4 p-4 overflow-x-auto bg-background border-b">
      {/* Create Story Button */}
      <div className="flex flex-col items-center space-y-1 min-w-fit">
        <CreateStory onStoryCreated={fetchStories} />
        <span className="text-xs text-center">Your story</span>
      </div>

      {/* Stories */}
      {stories.map((story) => (
        <div key={story.id} className="flex flex-col items-center space-y-1 min-w-fit">
          <div className="relative">
            <div className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
              <Avatar className="h-full w-full border-2 border-background">
                <AvatarImage src={story.users.profile_picture_url} />
                <AvatarFallback>{story.users.username?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <span className="text-xs text-center max-w-[64px] truncate">
            {story.users.username}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StoriesBar;
