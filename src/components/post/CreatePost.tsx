
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import MediaUpload from '@/components/media/MediaUpload';
import { Globe, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [media, setMedia] = useState<{ type: 'image' | 'video'; url: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!content.trim() && media.length === 0)) return;

    setIsSubmitting(true);
    try {
      // Convert media files to base64 URLs for storage
      const mediaUrls: string[] = [];
      for (const mediaItem of media) {
        mediaUrls.push(mediaItem.url); // Already base64 from MediaUpload
      }

      const postType = media.length > 0 
        ? (media[0].type === 'video' ? 'video' : 'image')
        : 'text';

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          type: postType,
          is_public: isPublic,
        });

      if (error) {
        console.error('Error creating post:', error);
        toast({
          title: "Error",
          description: "Failed to create post",
          variant: "destructive",
        });
      } else {
        // Get current posts count and update it
        const { data: currentUser } = await supabase
          .from('users')
          .select('posts_count')
          .eq('id', user.id)
          .single();

        await supabase
          .from('users')
          .update({ 
            posts_count: (currentUser?.posts_count || 0) + 1
          })
          .eq('id', user.id);

        setContent('');
        setMedia([]);
        setIsPublic(true);
        onPostCreated();
        toast({
          title: "Success",
          description: "Post created successfully!",
        });
      }
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="What's happening?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[80px] resize-none border-none focus-visible:ring-0 p-0 text-lg placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <MediaUpload onMediaSelect={setMedia} onEmojiClick={handleEmojiClick} />

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isPublic ? (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="public-toggle" className="text-sm">
                  {isPublic ? 'Public' : 'Private'}
                </Label>
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={(!content.trim() && media.length === 0) || isSubmitting}
              className="px-6"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatePost;
