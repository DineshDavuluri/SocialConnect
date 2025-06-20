
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Eye, X } from 'lucide-react';

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newStory, setNewStory] = useState({ content: '', mediaFile: null });
  const [loading, setLoading] = useState(false);

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

  const handleCreateStory = async () => {
    if (!user || !newStory.mediaFile) return;

    setLoading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const { error } = await supabase
          .from('stories')
          .insert({
            user_id: user.id,
            media_url: base64,
            media_type: newStory.mediaFile!.type.startsWith('video/') ? 'video' : 'image',
            content: newStory.content,
          });

        if (error) {
          console.error('Error creating story:', error);
          toast({
            title: "Error",
            description: "Failed to create story",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Story created successfully!",
          });
          setIsCreateOpen(false);
          setNewStory({ content: '', mediaFile: null });
          fetchStories();
        }
      };
      reader.readAsDataURL(newStory.mediaFile);
    } catch (error) {
      console.error('Error creating story:', error);
      toast({
        title: "Error",
        description: "Failed to create story",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const viewStory = async (story: any) => {
    setSelectedStory(story);
    
    // Increment view count
    await supabase.rpc('increment_story_views', { story_id: story.id });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Stories</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Story
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Story</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewStory(prev => ({ ...prev, mediaFile: file }));
                    }
                  }}
                />
                <Textarea
                  placeholder="Add a caption..."
                  value={newStory.content}
                  onChange={(e) => setNewStory(prev => ({ ...prev, content: e.target.value }))}
                />
                <Button onClick={handleCreateStory} disabled={loading || !newStory.mediaFile}>
                  {loading ? 'Creating...' : 'Create Story'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {stories.map((story) => (
            <Card 
              key={story.id} 
              className="cursor-pointer hover:scale-105 transition-transform aspect-[9/16] relative overflow-hidden"
              onClick={() => viewStory(story)}
            >
              <div className="absolute inset-0">
                {story.media_type === 'video' ? (
                  <video
                    src={story.media_url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={story.media_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={story.users.profile_picture_url} />
                      <AvatarFallback className="text-xs">
                        {story.users.username?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-white text-sm font-medium">{story.users.username}</p>
                  </div>
                  <div className="flex items-center space-x-2 text-white/80 text-xs">
                    <Eye className="h-3 w-3" />
                    <span>{story.views_count || 0}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</span>
                  </div>
                  {story.content && (
                    <p className="text-white text-sm mt-2 line-clamp-2">{story.content}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Story Viewer */}
        {selectedStory && (
          <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
            <DialogContent className="max-w-md p-0 bg-black">
              <div className="relative aspect-[9/16]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedStory(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                {selectedStory.media_type === 'video' ? (
                  <video
                    src={selectedStory.media_url}
                    className="w-full h-full object-cover"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedStory.users.profile_picture_url} />
                      <AvatarFallback>
                        {selectedStory.users.username?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">{selectedStory.users.username}</p>
                      <p className="text-white/80 text-sm">
                        {formatDistanceToNow(new Date(selectedStory.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {selectedStory.content && (
                    <p className="text-white">{selectedStory.content}</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default Stories;
