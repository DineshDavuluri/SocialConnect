
import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import StoryEditor from './StoryEditor';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  content: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  story_data: any;
  music_data: any;
  filters: any;
  users: {
    id: string;
    username: string;
    profile_picture_url: string;
  };
}

const EnhancedStoriesBar = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);

  useEffect(() => {
    if (user) {
      fetchStories();
      
      // Set up realtime subscription
      const channel = supabase
        .channel('stories_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'stories'
        }, () => {
          fetchStories();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedStory) {
      interval = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            handleNextStory();
            return 0;
          }
          return prev + 2;
        });
      }, 100); // 5 second stories (100 * 50ms = 5000ms)
    }
    return () => clearInterval(interval);
  }, [selectedStory]);

  const fetchStories = async () => {
    if (!user) return;

    try {
      // Fetch stories from followed users only
      const { data: followingStories } = await supabase
        .from('stories')
        .select(`
          *,
          users (
            id,
            username,
            profile_picture_url
          )
        `)
        .gt('expires_at', new Date().toISOString())
        .in('user_id', await getFollowingUserIds())
        .order('created_at', { ascending: false });

      // Fetch user's own stories
      const { data: ownStories } = await supabase
        .from('stories')
        .select(`
          *,
          users (
            id,
            username,
            profile_picture_url
          )
        `)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      setStories(followingStories || []);
      setUserStories(ownStories || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const getFollowingUserIds = async () => {
    if (!user) return [];
    
    try {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      
      return follows?.map(f => f.following_id) || [];
    } catch (error) {
      console.error('Error fetching following users:', error);
      return [];
    }
  };

  const viewStory = async (story: Story, index: number) => {
    setSelectedStory(story);
    setCurrentStoryIndex(index);
    setStoryProgress(0);
    
    // Increment view count
    if (story.user_id !== user?.id) {
      await supabase.rpc('increment_story_views', { story_id: story.id });
    }
  };

  const handleNextStory = () => {
    const allStories = [...userStories, ...stories];
    const nextIndex = currentStoryIndex + 1;
    
    if (nextIndex < allStories.length) {
      viewStory(allStories[nextIndex], nextIndex);
    } else {
      setSelectedStory(null);
      setStoryProgress(0);
    }
  };

  const handlePrevStory = () => {
    const allStories = [...userStories, ...stories];
    const prevIndex = currentStoryIndex - 1;
    
    if (prevIndex >= 0) {
      viewStory(allStories[prevIndex], prevIndex);
    }
  };

  const renderTextOverlays = (storyData: any) => {
    if (!storyData?.textOverlays) return null;
    
    return storyData.textOverlays.map((overlay: any) => (
      <div
        key={overlay.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          color: overlay.color,
          fontSize: `${overlay.fontSize}px`,
          fontFamily: overlay.fontFamily,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
        }}
      >
        {overlay.text}
      </div>
    ));
  };

  const renderStickerOverlays = (storyData: any) => {
    if (!storyData?.stickerOverlays) return null;
    
    return storyData.stickerOverlays.map((overlay: any) => (
      <div
        key={overlay.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          fontSize: `${overlay.size}px`
        }}
      >
        {overlay.emoji}
      </div>
    ));
  };

  const renderMusicOverlay = (musicData: any) => {
    if (!musicData?.title) return null;
    
    return (
      <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-2 flex items-center space-x-2">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">♪</span>
        </div>
        <div className="text-white text-sm">
          <p className="font-medium">{musicData.title}</p>
          <p className="text-xs opacity-80">{musicData.artist}</p>
        </div>
      </div>
    );
  };

  const groupedStories = React.useMemo(() => {
    const groups = new Map<string, Story[]>();
    
    // Add user's own stories first
    if (userStories.length > 0) {
      groups.set(user!.id, userStories);
    }
    
    // Group other users' stories
    stories.forEach(story => {
      const userId = story.user_id;
      if (!groups.has(userId)) {
        groups.set(userId, []);
      }
      groups.get(userId)!.push(story);
    });
    
    return Array.from(groups.entries());
  }, [userStories, stories, user]);

  if (!user) return null;

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex space-x-4 p-4 overflow-x-auto scrollbar-hide">
        {/* Create Story Button */}
        <div className="flex flex-col items-center space-y-2 min-w-fit">
          <div className="relative">
            <Avatar className="h-16 w-16 cursor-pointer" onClick={() => setIsEditorOpen(true)}>
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-white"
              onClick={() => setIsEditorOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <span className="text-xs text-center font-medium">Your Story</span>
        </div>

        {/* Stories from followed users */}
        {groupedStories.map(([userId, userStories], groupIndex) => {
          const latestStory = userStories[0];
          const isOwnStory = userId === user.id;
          
          if (isOwnStory && userStories.length === 0) return null;
          
          return (
            <div key={userId} className="flex flex-col items-center space-y-2 min-w-fit">
              <div 
                className="relative cursor-pointer"
                onClick={() => viewStory(latestStory, groupIndex)}
              >
                <div className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                  <Avatar className="h-full w-full border-2 border-white dark:border-gray-900">
                    <AvatarImage src={latestStory.users.profile_picture_url} />
                    <AvatarFallback className="bg-gray-200 dark:bg-gray-700">
                      {latestStory.users.username?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {userStories.length > 1 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {userStories.length}
                  </div>
                )}
              </div>
              <span className="text-xs text-center max-w-[64px] truncate font-medium">
                {isOwnStory ? 'You' : latestStory.users.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* Story Viewer */}
      {selectedStory && (
        <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
          <DialogContent className="max-w-md p-0 bg-black border-none">
            <div className="relative aspect-[9/16] bg-black">
              {/* Progress Bar */}
              <div className="absolute top-2 left-2 right-2 z-20">
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div 
                    className="bg-white h-1 rounded-full transition-all duration-100"
                    style={{ width: `${storyProgress}%` }}
                  />
                </div>
              </div>

              {/* Header */}
              <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8 border border-white">
                    <AvatarImage src={selectedStory.users.profile_picture_url} />
                    <AvatarFallback className="text-xs">
                      {selectedStory.users.username?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium text-sm">{selectedStory.users.username}</p>
                    <p className="text-white/80 text-xs">
                      {formatDistanceToNow(new Date(selectedStory.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setSelectedStory(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Story Content */}
              <div className="relative w-full h-full">
                {selectedStory.media_type === 'video' ? (
                  <video
                    src={selectedStory.media_url}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    onEnded={handleNextStory}
                  />
                ) : selectedStory.media_type === 'audio' ? (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                    <audio
                      src={selectedStory.media_url}
                      controls
                      autoPlay
                      className="w-3/4"
                      onEnded={handleNextStory}
                    />
                  </div>
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Overlays */}
                {renderTextOverlays(selectedStory.story_data)}
                {renderStickerOverlays(selectedStory.story_data)}
                {renderMusicOverlay(selectedStory.music_data)}
              </div>

              {/* Navigation */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
                onClick={handlePrevStory}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
                onClick={handleNextStory}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              {/* Caption */}
              {selectedStory.content && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/50 rounded-lg p-3">
                  <p className="text-white text-sm">{selectedStory.content}</p>
                </div>
              )}

              {/* Views count (for own stories) */}
              {selectedStory.user_id === user?.id && (
                <div className="absolute bottom-16 left-4 flex items-center space-x-2 text-white/80">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{selectedStory.views_count || 0} views</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Story Editor */}
      <StoryEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onStoryCreated={fetchStories}
      />
    </div>
  );
};

export default EnhancedStoriesBar;
