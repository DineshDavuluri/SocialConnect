
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  Heart, 
  MessageCircle, 
  Share, 
  Bookmark, 
  MoreVertical, 
  Edit, 
  Trash2,
  Send
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Post {
  id: string;
  content: string;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  user_id: string;
  users: {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
  };
}

interface EnhancedPostCardProps {
  post: Post;
  onPostUpdated: () => void;
  onPostDeleted: () => void;
}

const EnhancedPostCard = ({ post, onPostUpdated, onPostDeleted }: EnhancedPostCardProps) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const displayName = post.users.first_name && post.users.last_name
    ? `${post.users.first_name} ${post.users.last_name}`
    : post.users.username;

  const isOwner = user?.id === post.user_id;

  React.useEffect(() => {
    if (user) {
      checkLikeStatus();
      checkSaveStatus();
      fetchFollowedUsers();
    }
  }, [user, post.id]);

  const checkLikeStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .single();
      
      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const checkSaveStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .single();
      
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking save status:', error);
    }
  };

  const fetchFollowedUsers = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('follows')
        .select(`
          following_id,
          users!follows_following_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('follower_id', user.id);

      const followedUsersData = data?.map(follow => follow.users).filter(Boolean) || [];
      setFollowedUsers(followedUsersData);
    } catch (error) {
      console.error('Error fetching followed users:', error);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id });
      }
      
      setIsLiked(!isLiked);
      onPostUpdated();
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      if (isSaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('saved_posts')
          .insert({ post_id: post.id, user_id: user.id });
      }
      
      setIsSaved(!isSaved);
      toast({
        title: isSaved ? "Post unsaved" : "Post saved",
        description: isSaved ? "Removed from saved posts" : "Added to saved posts",
      });
    } catch (error) {
      console.error('Error handling save:', error);
    }
  };

  const handleEdit = async () => {
    if (!user || !isOwner) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          content: editedContent,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to edit post",
          variant: "destructive",
        });
      } else {
        setShowEditDialog(false);
        onPostUpdated();
        toast({
          title: "Success",
          description: "Post updated successfully",
        });
      }
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !isOwner) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete post",
          variant: "destructive",
        });
      } else {
        onPostDeleted();
        toast({
          title: "Success",
          description: "Post deleted successfully",
        });
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const sharePost = async (receiverId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('post_shares')
        .insert({
          post_id: post.id,
          sender_id: user.id,
          receiver_id: receiverId,
          message: `Check out this post from ${displayName}`
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to share post",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Post shared successfully",
        });
        setShowShareDialog(false);
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <div className="flex items-center space-x-3 flex-1">
            <Avatar>
              <AvatarImage src={post.users.profile_picture_url} />
              <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                @{post.users.username} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                {post.is_edited && <span className="ml-1">(edited)</span>}
              </p>
            </div>
          </div>
          
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm">{post.content}</p>
          
          {post.media_urls && post.media_urls.length > 0 && (
            <div className="space-y-2">
              {post.media_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Post media ${index + 1}`}
                  className="w-full rounded-md object-cover max-h-64"
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={isLiked ? "text-red-500" : ""}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-current" : ""}`} />
                {post.likes_count}
              </Button>
              
              <Button variant="ghost" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                {post.comments_count}
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => setShowShareDialog(true)}>
                <Share className="h-4 w-4 mr-1" />
                {post.shares_count}
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className={isSaved ? "text-blue-500" : ""}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={loading}>
                {loading ? "Updating..." : "Update Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share with your followed users:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {followedUsers.map((userData) => (
                <div
                  key={userData.id}
                  className="flex items-center space-x-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                  onClick={() => sharePost(userData.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userData.profile_picture_url} />
                    <AvatarFallback>
                      {userData.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {userData.first_name && userData.last_name
                        ? `${userData.first_name} ${userData.last_name}`
                        : userData.username}
                    </p>
                    <p className="text-xs text-muted-foreground">@{userData.username}</p>
                  </div>
                  <Send className="h-4 w-4 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedPostCard;
