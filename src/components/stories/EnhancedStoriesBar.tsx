import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import StoryEditor from './StoryEditor';
import { Json } from '@/integrations/supabase/types';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  backgroundColor?: string;
}

interface StickerOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

interface GifOverlay {
  id: string;
  url: string;
  x: number;
  y: number;
  size: number;
}

interface MusicSelection {
  title: string;
  artist: string;
  duration: number;
  url: string;
}

interface StoryData {
  textOverlays?: TextOverlay[];
  stickerOverlays?: StickerOverlay[];
  gifOverlays?: GifOverlay[];
  filter?: string;
}

interface FetchedStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  content?: string | null;
  created_at: string;
  expires_at: string;
  views_count: number;
  story_data: Json | null;
  music_data: Json | null;
  filters?: Json;
  users: {
    id: string;
    username: string;
    profile_picture_url?: string;
  } | null;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  content?: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  story_data: StoryData | null;
  music_data: MusicSelection | null;
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      fetchStories();

      const channel = supabase
        .channel('stories_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'stories',
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
    let interval: NodeJS.Timeout | undefined;

    if (selectedStory) {
      if (selectedStory.media_type === 'image') {
        // For images, use a 5-second timer
        interval = setInterval(() => {
          setStoryProgress(prev => {
            if (prev >= 100) {
              handleNextStory();
              return 0;
            }
            return prev + 100 / (5000 / 50); // 5-second duration (5000ms / 50ms intervals)
          });
        }, 50);
      } else if (selectedStory.media_type === 'video' && videoRef.current) {
        // For videos, update progress based on playback
        const video = videoRef.current;
        const updateProgress = () => {
          if (video.duration) {
            setStoryProgress((video.currentTime / video.duration) * 100);
          }
        };
        video.addEventListener('timeupdate', updateProgress);
        return () => {
          video.removeEventListener('timeupdate', updateProgress);
        };
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedStory]);

  const isJsonObject = (value: Json | null): value is { [key: string]: Json } => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  };

  const isValidTextOverlay = (item: unknown): item is TextOverlay => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      'id' in obj &&
      typeof obj.id === 'string' &&
      'text' in obj &&
      typeof obj.text === 'string' &&
      'x' in obj &&
      typeof obj.x === 'number' &&
      'y' in obj &&
      typeof obj.y === 'number' &&
      'color' in obj &&
      typeof obj.color === 'string' &&
      'fontSize' in obj &&
      typeof obj.fontSize === 'number' &&
      'fontFamily' in obj &&
      typeof obj.fontFamily === 'string'
    );
  };

  const isValidStickerOverlay = (item: unknown): item is StickerOverlay => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      'id' in obj &&
      typeof obj.id === 'string' &&
      'emoji' in obj &&
      typeof obj.emoji === 'string' &&
      'x' in obj &&
      typeof obj.x === 'number' &&
      'y' in obj &&
      typeof obj.y === 'number' &&
      'size' in obj &&
      typeof obj.size === 'number'
    );
  };

  const isValidGifOverlay = (item: unknown): item is GifOverlay => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      'id' in obj &&
      typeof obj.id === 'string' &&
      'url' in obj &&
      typeof obj.url === 'string' &&
      'x' in obj &&
      typeof obj.x === 'number' &&
      'y' in obj &&
      typeof obj.y === 'number' &&
      'size' in obj &&
      typeof obj.size === 'number'
    );
  };

  const transformFetchedStory = (fetched: FetchedStory): Story | null => {
    if (!fetched.users || !fetched.media_url) return null;

    let storyData: StoryData | null = null;

    let musicData: MusicSelection | null = null;
    if (isJsonObject(fetched.music_data)) {
      musicData = {
        title: typeof fetched.music_data.title === 'string' ? fetched.music_data.title : '',
        artist: typeof fetched.music_data.artist === 'string' ? fetched.music_data.artist : '',
        duration: typeof fetched.music_data.duration === 'number' ? fetched.music_data.duration : 0,
        url: typeof fetched.music_data.url === 'string' ? fetched.music_data.url : '',
      };
    }

    return {
      id: fetched.id,
      user_id: fetched.user_id,
      media_url: fetched.media_url,
      media_type: fetched.media_type,
      content: fetched.content || undefined,
      created_at: fetched.created_at,
      expires_at: fetched.expires_at,
      views_count: fetched.views_count,
      story_data: storyData,
      music_data: musicData,
      users: {
        id: fetched.users.id,
        username: fetched.users.username || 'Unknown',
        profile_picture_url: fetched.users.profile_picture_url || '',
      },
    };
  };

  const fetchStories = async () => {
    if (!user) return;

    try {
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

      const transformedFollowingStories = (followingStories || [])
        .map(transformFetchedStory)
        .filter((story): story is Story => story !== null);
      const transformedOwnStories = (ownStories || [])
        .map(transformFetchedStory)
        .filter((story): story is Story => story !== null);

      setStories(transformedFollowingStories);
      setUserStories(transformedOwnStories);
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

  const renderTextOverlays = (storyData: StoryData | null) => {
    if (!storyData?.textOverlays?.length) return null;

    return storyData.textOverlays.map(overlay => (
      <div
        key={overlay.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          color: overlay.color,
          fontSize: `${overlay.fontSize}px`,
          fontFamily: overlay.fontFamily,
          backgroundColor: overlay.backgroundColor || 'transparent',
          padding: '2px 4px',
          borderRadius: 4,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {overlay.text}
      </div>
    ));
  };

  const renderStickerOverlays = (storyData: StoryData | null) => {
    if (!storyData?.stickerOverlays?.length) return null;

    return storyData.stickerOverlays.map(overlay => (
      <div
        key={overlay.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          fontSize: `${overlay.size}px`,
        }}
      >
        {overlay.emoji}
      </div>
    ));
  };

  const renderGIFOverlays = (storyData: StoryData | null) => {
    if (!storyData?.gifOverlays?.length) return null;

    return storyData.gifOverlays.map(overlay => (
      <div
        key={overlay.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          width: `${overlay.size}px`,
          height: `${overlay.size}px`,
        }}
      >
        <img src={overlay.url} alt="GIF" className="w-full h-full object-contain" />
      </div>
    ));
  };

  const renderMusicOverlay = (musicData: MusicSelection | null) => {
    if (!musicData?.title) return null;

    return (
      <>
        <audio src={musicData.url} autoPlay loop />
        <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-2 flex items-center space-x-2 z-50">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">♪</span>
          </div>
          <div className="text-white text-sm">
            <p className="font-medium">{musicData.title}</p>
            <p className="text-xs opacity-80">{musicData.artist}</p>
          </div>
        </div>
      </>
    );
  };

  const groupedStories = React.useMemo(() => {
    const groups = new Map<string, Story[]>();

    if (userStories.length > 0) {
      groups.set(user!.id, userStories);
    }

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

      {selectedStory && (
        <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
          <DialogContent className="max-w-md p-0 bg-black border-none">
            <div className="relative aspect-[9/16] bg-black">
              <div className="absolute top-2 left-2 right-2 z-20">
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-white h-1 rounded-full transition-all duration-[50ms]"
                    style={{ width: `${storyProgress}%` }}
                  />
                </div>
              </div>

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

              <div className="relative w-full h-full">
                {selectedStory.media_type === 'video' ? (
                  <video
                    ref={videoRef}
                    src={selectedStory.media_url}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted={selectedStory.music_data ? true : false}
                    onEnded={handleNextStory}
                  />
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                    style={{ filter: selectedStory.story_data?.filter || 'none' }}
                  />
                )}

                {renderTextOverlays(selectedStory.story_data)}
                {renderStickerOverlays(selectedStory.story_data)}
                {renderGIFOverlays(selectedStory.story_data)}
                {renderMusicOverlay(selectedStory.music_data)}
              </div>

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

              {selectedStory.content && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/50 rounded-lg p-3">
                  <p className="text-white text-sm">{selectedStory.content}</p>
                </div>
              )}

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

      <StoryEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onStoryCreated={fetchStories}
      />
    </div>
  );
};

export default EnhancedStoriesBar;