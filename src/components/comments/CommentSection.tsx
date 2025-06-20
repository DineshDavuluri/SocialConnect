import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Heart, Reply } from 'lucide-react';

interface CommentSectionProps {
  postId: string;
  onCommentCountChange: (count: number) => void;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  likes_count: number;
  users: {
    username: string;
    profile_picture_url: string;
  };
  replies?: Comment[];
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const { data } = await supabase
        .from('comments')
        .select(`
          *,
          users (
            username,
            profile_picture_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (data) {
        // Organize comments with their replies
        const commentsMap = new Map();
        const rootComments: Comment[] = [];

        data.forEach(comment => {
          commentsMap.set(comment.id, { ...comment, replies: [] });
        });

        data.forEach(comment => {
          if (comment.parent_id) {
            const parent = commentsMap.get(comment.parent_id);
            if (parent) {
              parent.replies.push(commentsMap.get(comment.id));
            }
          } else {
            rootComments.push(commentsMap.get(comment.id));
          }
        });

        setComments(rootComments);
        onCommentCountChange(data.length);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add comment",
          variant: "destructive",
        });
      } else {
        setNewComment('');
        fetchComments();
        
        // Update post comments count
        const { data: post } = await supabase
          .from('posts')
          .select('comments_count')
          .eq('id', postId)
          .single();

        await supabase
          .from('posts')
          .update({ comments_count: (post?.comments_count || 0) + 1 })
          .eq('id', postId);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReply = async (parentId: string) => {
    if (!user || !replyContent.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: replyContent.trim(),
          parent_id: parentId,
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add reply",
          variant: "destructive",
        });
      } else {
        setReplyContent('');
        setReplyTo(null);
        fetchComments();

        // Update post comments count
        const { data: post } = await supabase
          .from('posts')
          .select('comments_count')
          .eq('id', postId)
          .single();

        await supabase
          .from('posts')
          .update({ comments_count: (post?.comments_count || 0) + 1 })
          .eq('id', postId);
      }
    } catch (error) {
      console.error('Error adding reply:', error);
    } finally {
      setLoading(false);
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`space-y-3 ${isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.users.profile_picture_url} />
          <AvatarFallback>{comment.users.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-sm">{comment.users.username}</p>
            <p className="text-sm mt-1">{comment.content}</p>
          </div>
          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
              <Heart className="h-3 w-3 mr-1" />
              {comment.likes_count || 0}
            </Button>
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
          </div>
          
          {replyTo === comment.id && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[60px]"
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleAddReply(comment.id)}
                  disabled={loading || !replyContent.trim()}
                >
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">Comments ({comments.length})</span>
        </div>

        {user && (
          <div className="space-y-3">
            <div className="flex space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <Button
              onClick={handleAddComment}
              disabled={loading || !newComment.trim()}
              className="ml-11"
            >
              {loading ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>

        {comments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No comments yet. Be the first to comment!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CommentSection;
