import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Heart,
  MessageCircle,
  Share,
  MoreHorizontal,
  CheckCircle,
  UserPlus,
  Bookmark,
  Send,
  Edit,
  Trash2
} from 'lucide-react';
import EnhancedCommentSection from '@/components/comments/EnhancedCommentSection';

interface PostCardProps {
  post: any;
  onLike: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike }) => {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isOwner = user?.id === post.user_id;

  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
      checkIfFollowing();
      fetchRealTimeCounts();
      fetchFollowedUsers();
    }
  }, [user, post.id]);

  const checkIfLiked = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post.id)
      .single();

    setIsLiked(!!data);
  };

  const checkIfSaved = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('saved_posts')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post.id)
      .single();

    setIsSaved(!!data);
  };

  const checkIfFollowing = async () => {
    if (!user || user.id === post.user_id) return;

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', post.user_id)
      .single();

    setIsFollowing(!!data);
  };

  const fetchRealTimeCounts = async () => {
    // Get real-time likes count
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    // Get real-time comments count
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    setLikesCount(likesCount || 0);
    setCommentsCount(commentsCount || 0);
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
    if (!user || isLiking) return;

    setIsLiking(true);
    try {
      if (isLiked) {
        // Unlike the post
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);

        await supabase
          .from('posts')
          .update({ likes_count: Math.max(0, likesCount - 1) })
          .eq('id', post.id);

        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        // Like the post
        await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            post_id: post.id,
          });

        await supabase
          .from('posts')
          .update({ likes_count: likesCount + 1 })
          .eq('id', post.id);

        setIsLiked(true);
        setLikesCount(prev => prev + 1);

        // Create notification for post owner
        if (post.user_id !== user.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: post.user_id,
              actor_id: user.id,
              type: 'like',
              post_id: post.id,
              message: 'liked your post'
            });
        }
      }

      onLike();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      if (isSaved) {
        // Unsave the post
        await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);

        // Update saved count
        const { data: currentPost } = await supabase
          .from('posts')
          .select('saved_count')
          .eq('id', post.id)
          .single();

        await supabase
          .from('posts')
          .update({ saved_count: Math.max(0, (currentPost?.saved_count || 0) - 1) })
          .eq('id', post.id);

        setIsSaved(false);
        toast({
          title: "Removed",
          description: "Post removed from saved",
        });
      } else {
        // Save the post
        await supabase
          .from('saved_posts')
          .insert({
            user_id: user.id,
            post_id: post.id,
          });

        // Update saved count
        const { data: currentPost } = await supabase
          .from('posts')
          .select('saved_count')
          .eq('id', post.id)
          .single();

        await supabase
          .from('posts')
          .update({ saved_count: (currentPost?.saved_count || 0) + 1 })
          .eq('id', post.id);

        setIsSaved(true);
        toast({
          title: "Saved",
          description: "Post saved successfully",
        });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: "Error",
        description: "Failed to save post",
        variant: "destructive",
      });
    }
  };

  const handleFollow = async () => {
    if (!user || isFollowLoading || user.id === post.user_id) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id);

        setIsFollowing(false);
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: post.user_id,
          });

        setIsFollowing(true);

        // Create notification for followed user
        await supabase
          .from('notifications')
          .insert({
            user_id: post.user_id,
            actor_id: user.id,
            type: 'follow',
            message: 'started following you'
          });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    } finally {
      setIsFollowLoading(false);
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
        post.content = editedContent;
        post.is_edited = true;
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
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete post",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Post deleted successfully",
        });
        // Trigger parent component to refresh posts
        onLike();
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
          message: `Check out this post!`
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

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `Post by ${post.users.username}`,
        text: post.content,
        url: window.location.href,
      });
    } catch (error) {
      // Fallback to sharing with followers
      setShowShareDialog(true);
    }
  };

  return (
    <>
      <Card className="w-full bg-white dark:bg-gray-800 border-0 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-700">
                <AvatarImage src={post.users.profile_picture_url} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                  {post.users.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{post.users.username}</p>
                  {post.users.is_verified && (
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  )}
                  {post.is_edited && (
                    <Badge variant="secondary" className="text-xs">edited</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {user && user.id !== post.user_id && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={`rounded-full px-4 ${isFollowing
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                    }`}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {isOwner && (
                    <>
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Post
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share className="h-4 w-4 mr-2" />
                    Share with Followers
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {post.content && (
            <p className="text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">{post.content}</p>
          )}

          {post.media_urls && post.media_urls.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700">
              {post.type === 'image' ? (
                <div className="grid gap-1">
                  {post.media_urls.map((url: string, index: number) => (
                    <img
                      key={index}
                      src={url}
                      alt="Post media"
                      className="w-full h-auto max-h-[500px] object-cover"
                    />
                  ))}
                </div>
              ) : post.type === 'video' ? (
                <video
                  src={post.media_urls[0]}
                  controls
                  className="w-full h-auto max-h-[500px] rounded-2xl"
                />
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center space-x-2 rounded-full px-3 py-2 ${isLiked
                  ? 'text-red-500 bg-red-50 dark:bg-red-950/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                  }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="font-medium">{likesCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-full px-3 py-2"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="font-medium">{commentsCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 rounded-full px-3 py-2"
              >
                <Send className="h-5 w-5" />
                <span className="font-medium">{post.shares_count || 0}</span>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className={`rounded-full p-2 ${isSaved
                ? 'text-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20'
                }`}
            >
              <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {showComments && (
            <div className="mt-4 -mx-4">
              <EnhancedCommentSection
                postId={post.id}
                onCommentCountChange={(count) => setCommentsCount(count)}
              />
            </div>
          )}
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

export default PostCard;
