import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Send,
  CheckCheck,
  Check,
  Edit,
  Trash2,
  Reply,
  MoreVertical,
  Share,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import MessageReactions from './MessageReactions';
import { debounce } from 'lodash';

// Type Definitions
interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  privacy_settings?: any;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content?: string;
  message?: string; // Optional for shared posts
  created_at: string;
  is_read?: boolean;
  is_edited?: boolean;
  reply_to?: string;
  type: 'message' | 'shared_post';
  sender?: User;
  reply_to_message?: Partial<Message>;
  post?: Post;
  deleted_at?: string | null;
  deleted_for_everyone?: boolean;
  deleted_for_everyone_at?: string | null;
  edited_at?: string | null;
}

interface Post {
  id: string;
  content: string;
  media_urls?: string[];
  type?: string;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  user_id: string;
  users?: User;
}

const InstagramMessages: React.FC = () => {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<User[]>([]);
  const [allFollowedUsers, setAllFollowedUsers] = useState<User[]>([]);
  const [messageRequests, setMessageRequests] = useState<User[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<{ user: User } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({});
  const [isFollowLoading, setIsFollowLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false); // Added loading state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced typing handler
  const debouncedHandleTyping = useCallback(
    debounce(() => {
      setIsTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 1000);
    }, 300),
    []
  );

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch mutual follows and all followed users
  const fetchFollowedUsers = async () => {
    if (!user) return;

    setLoading(true); // Set loading
    try {
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select(`
          following_id,
          users!follows_following_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture_url,
            privacy_settings
          )
        `)
        .eq('follower_id', user.id);

      if (followingError) {
        throw followingError;
      }

      const followedUsersData = followingData?.map(follow => follow.users).filter(Boolean) || [];
      setAllFollowedUsers(followedUsersData);

      const followingIds = followingData?.map(follow => follow.following_id) || [];
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followersError) {
        throw followersError;
      }

      const followerIds = followersData?.map(follow => follow.follower_id) || [];
      const mutualFollowIds = followingIds.filter(id => followerIds.includes(id));

      const { data: mutualUsersData, error: mutualUsersError } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, profile_picture_url, privacy_settings')
        .in('id', mutualFollowIds);

      if (mutualUsersError) {
        throw mutualUsersError;
      }

      setFollowedUsers(mutualUsersData || []);

      // Initialize follow status for message request users
      const initialFollowStatus = followedUsersData.reduce((acc, userData) => {
        acc[userData.id] = true; // Already followed
        return acc;
      }, {} as Record<string, boolean>);
      setFollowStatus(prev => ({ ...prev, ...initialFollowStatus }));
    } catch (error) {
      console.error('Error fetching followed users:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Clear loading
    }
  };

  // Fetch message requests (non-mutual senders)
  const fetchMessageRequests = async () => {
    if (!user) return;

    setLoading(true); // Set loading
    try {
      const { data: messageSenders, error: sendersError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('deleted_for_everyone', false);

      if (sendersError) {
        throw sendersError;
      }

      const senderIds = [...new Set(messageSenders.map(m => m.sender_id))].filter(id => id !== user.id);

      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(follow => follow.following_id) || [];
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      const followerIds = followersData?.map(follow => follow.follower_id) || [];
      const mutualFollowIds = followingIds.filter(id => followerIds.includes(id));

      const nonMutualSenders = senderIds.filter(id => !mutualFollowIds.includes(id));

      const { data: senderUsers, error: usersError } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, profile_picture_url, privacy_settings')
        .in('id', nonMutualSenders);

      if (usersError) {
        throw usersError;
      }

      setMessageRequests(senderUsers || []);

      // Update follow status for message request users
      const followStatusUpdate = senderUsers?.reduce((acc, userData) => {
        acc[userData.id] = followingIds.includes(userData.id);
        return acc;
      }, {} as Record<string, boolean>) || {};
      setFollowStatus(prev => ({ ...prev, ...followStatusUpdate }));
    } catch (error) {
      console.error('Error fetching message requests:', error);
      toast({
        title: "Error",
        description: "Failed to load message requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Clear loading
    }
  };

  // Fetch messages
  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    setLoading(true); // Set loading
    try {
      console.log('Fetching messages between:', user.id, 'and:', otherUserId);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          is_read,
          is_edited,
          reply_to,
          deleted_at,
          deleted_for_everyone,
          deleted_for_everyone_at,
          edited_at
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .eq('deleted_for_everyone', false)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        toast({
          title: "Database Error",
          description: `Failed to load messages: ${messagesError.message}`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch sender data
      const senderIds = [...new Set([...messagesData.map(m => m.sender_id), otherUserId, user.id])];
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, profile_picture_url')
        .in('id', senderIds);

      if (usersError) {
        console.error('Error fetching users data:', usersError);
        toast({
          title: "Error",
          description: "Failed to load user data",
          variant: "destructive",
        });
      }

      const usersMap: Record<string, User> = usersData?.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, User>) || {};

      // Fetch reply-to messages
      const replyToIds = messagesData.filter(m => m.reply_to).map(m => m.reply_to);
      let replyMessagesMap: Record<string, Partial<Message>> = {};
      if (replyToIds.length > 0) {
        const { data: replyMessages, error: replyError } = await supabase
          .from('messages')
          .select('id, content, sender_id')
          .in('id', replyToIds);

        if (replyError) {
          console.error('Error fetching reply messages:', replyError);
        } else if (replyMessages) {
          replyMessagesMap = replyMessages.reduce((acc, msg) => {
            acc[msg.id] = {
              ...msg,
              sender: usersMap[msg.sender_id],
            };
            return acc;
          }, {} as Record<string, Partial<Message>>);
        }
      }

      // Fetch shared posts
      const { data: sharedPostsData, error: sharedPostsError } = await supabase
        .from('post_shares')
        .select(`
          id,
          sender_id,
          receiver_id,
          post_id,
          message,
          created_at
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (sharedPostsError) {
        console.error('Error fetching shared posts:', sharedPostsError);
        toast({
          title: "Database Error",
          description: `Failed to load shared posts: ${sharedPostsError.message}`,
          variant: "destructive",
        });
      }

      // Fetch posts data for shares
      let postsMap: Record<string, Post> = {};
      if (sharedPostsData && sharedPostsData.length > 0) {
        const postIds = sharedPostsData.filter(s => s.post_id).map(s => s.post_id);
        if (postIds.length > 0) {
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select(`
              id,
              content,
              media_urls,
              type,
              likes_count,
              comments_count,
              created_at,
              user_id
            `)
            .in('id', postIds);

          if (postsError) {
            console.error('Error fetching posts:', postsError);
          } else if (postsData) {
            const postUserIds = [...new Set(postsData.map(p => p.user_id))];
            const { data: postUsersData, error: postUsersError } = await supabase
              .from('users')
              .select('id, username, first_name, last_name, profile_picture_url')
              .in('id', postUserIds);

            if (postUsersError) {
              console.error('Error fetching post users:', postUsersError);
            }

            const postUsersMap: Record<string, User> = postUsersData?.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {} as Record<string, User>) || {};

            postsMap = postsData.reduce((acc, post) => {
              acc[post.id] = {
                ...post,
                users: postUsersMap[post.user_id],
              };
              return acc;
            }, {} as Record<string, Post>);
          }
        }
      }

      console.log('Messages data:', messagesData);
      console.log('Shared posts data:', sharedPostsData);

      // Enhance messages
      const enhancedMessages: Message[] = messagesData.map(msg => ({
        ...msg,
        type: 'message' as const,
        sender: usersMap[msg.sender_id],
        reply_to_message: msg.reply_to ? replyMessagesMap[msg.reply_to] : undefined,
      }));

      // Enhance shared posts
      const enhancedShares: Message[] = (sharedPostsData || []).map(share => ({
        ...share,
        type: 'shared_post' as const,
        sender: usersMap[share.sender_id],
        post: share.post_id ? postsMap[share.post_id] : undefined,
        is_read: false,
        deleted_for_everyone: false,
        is_edited: false,
      }));

      // Combine and sort
      const combinedData: Message[] = [...enhancedMessages, ...enhancedShares].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      console.log('Combined conversation history:', combinedData);
      setMessages(combinedData);

      // Fetch reactions for messages
      if (messagesData && messagesData.length > 0) {
        await fetchMessageReactions(messagesData.map(m => m.id));
      }
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Clear loading
    }
  };

  // Fetch message reactions
  const fetchMessageReactions = async (messageIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (error) {
        throw error;
      }

      const groupedReactions = data?.reduce((acc, reaction) => {
        if (!acc[reaction.message_id]) {
          acc[reaction.message_id] = [];
        }
        acc[reaction.message_id].push(reaction);
        return acc;
      }, {} as Record<string, any[]>) || {};

      setMessageReactions(groupedReactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) {
      return;
    }

    try {
      const messageData = {
        sender_id: user.id,
        receiver_id: selectedConversation.user.id,
        content: newMessage.trim(),
        reply_to: replyingTo?.id || null,
        is_read: false,
        is_deleted: false,
        deleted_for_everyone: false,
      };

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) {
        throw error;
      }

      setNewMessage('');
      setReplyingTo(null);
      setIsTyping(false);
      await fetchMessages(selectedConversation.user.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  // Edit message
  const editMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) {
      toast({
        title: "Error",
        description: "Message content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent.trim(),
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) {
        throw error;
      }

      setEditingMessage(null);
      setEditedContent('');
      await fetchMessages(selectedConversation!.user.id);
      toast({
        title: "Success",
        description: "Message edited successfully",
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: "Error",
        description: "Failed to edit message",
        variant: "destructive",
      });
    }
  };

  // Delete message
  const deleteForEveryone = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          deleted_for_everyone: true,
          deleted_for_everyone_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) {
        throw error;
      }

      await fetchMessages(selectedConversation!.user.id);
      toast({
        title: "Success",
        description: "Message deleted for everyone",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  // Handle follow/unfollow
  const handleFollow = async (targetUserId: string) => {
    if (!user || isFollowLoading[targetUserId] || user.id === targetUserId) return;

    setIsFollowLoading(prev => ({ ...prev, [targetUserId]: true }));
    try {
      if (followStatus[targetUserId]) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (error) {
          throw error;
        }

        setFollowStatus(prev => ({ ...prev, [targetUserId]: false }));
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (error) {
          throw error;
        }

        setFollowStatus(prev => ({ ...prev, [targetUserId]: true }));

        // Fetch current user's username
        const { data: currentUserData, error: userError } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();

        if (userError) {
          throw userError;
        }

        // Create notification for followed user
        await supabase
          .from('notifications')
          .insert({
            user_id: targetUserId,
            actor_id: user.id,
            type: 'follow',
            message: `${currentUserData.username} started following you`,
          });
      }

      // Refresh followed users and message requests
      await fetchFollowedUsers();
      await fetchMessageRequests();
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    } finally {
      setIsFollowLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (payload.new.receiver_id === user.id) {
          fetchMessageRequests();
          if (selectedConversation?.user.id === payload.new.sender_id) {
            fetchMessages(payload.new.sender_id);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchFollowedUsers();
      fetchMessageRequests();
    }
  }, [user]);

  // Scroll to bottom on messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Search filter
  const filteredUsers = allFollowedUsers.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.first_name && user.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.last_name && user.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Skeleton loader
  const MessageSkeleton = () => (
    <div className="flex items-center p-4">
      <div className="h-10 w-10 rounded-full bg-muted mr-3"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded"></div>
        <div className="h-4 w-1/2 bg-muted rounded"></div>
      </div>
    </div>
  );

  // Render message content
  const renderMessageContent = (message: Message) => {
    if (message.type === 'shared_post') {
      if (!message.post) {
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Share className="h-3 w-3" />
              <span>Shared a post</span>
            </div>
            <div className="border rounded-xl p-3 bg-muted/30 max-w-xs">
              <p className="text-sm text-muted-foreground italic">This post is no longer available</p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Share className="h-3 w-3" />
            <span>Shared a post</span>
          </div>
          {message.message && <p className="text-sm mb-2">{message.message}</p>}
          <div className="border rounded-xl p-3 bg-muted/30 max-w-xs">
            <div className="flex items-center space-x-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={message.post.users?.profile_picture_url} />
                <AvatarFallback>
                  {message.post.users?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">@{message.post.users?.username || 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">
                {message.post.created_at && formatDistanceToNow(new Date(message.post.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm mb-2">{message.post.content || 'No content'}</p>
            {message.post.media_urls && message.post.media_urls.length > 0 && (
              <div className="rounded-lg overflow-hidden mb-2">
                {message.post.type === 'image' ? (
                  <img
                    src={message.post.media_urls[0]}
                    alt="Shared post media"
                    className="w-full h-32 object-cover rounded"
                    loading="lazy"
                  />
                ) : message.post.type === 'video' ? (
                  <video
                    src={message.post.media_urls[0]}
                    className="w-full h-32 object-cover rounded"
                    controls
                  />
                ) : null}
              </div>
            )}
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Heart className="h-3 w-3" />
                <span>{message.post.likes_count || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="h-3 w-3" />
                <span>{message.post.comments_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {message.reply_to_message && (
          <div className="text-xs opacity-70 mb-2 p-2 bg-muted/50 rounded-lg border-l-2 border-primary/30">
            <div className="text-muted-foreground font-medium mb-1">
              Replying to @{message.reply_to_message.sender?.username}:
            </div>
            <div className="text-foreground">{message.reply_to_message.content}</div>
          </div>
        )}

        {editingMessage === message.id ? (
          <div className="space-y-2">
            <Input
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  editMessage(message.id, editedContent);
                }
              }}
              className="border-none bg-transparent p-0 focus:ring-0"
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={() => editMessage(message.id, editedContent)} className="h-6 px-2 text-xs">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingMessage(null)} className="h-6 px-2 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm break-words">{message.content}</p>
            {message.is_edited && (
              <p className="text-xs opacity-60 mt-1">(edited)</p>
            )}
          </>
        )}
      </div>
    );
  };

  // Start conversation
  const startConversation = (userData: User) => {
    setSelectedConversation({ user: userData });
    setMessages([]);
    fetchMessages(userData.id);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Conversations List */}
        <div className="w-96 border-r border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Messages</h2>
            <Input
              placeholder="Search followed users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </div>
          <ScrollArea className="h-full">
            {/* Message Requests Section */}
            {messageRequests.length > 0 && (
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center">
                  Message Requests
                  <Badge className="ml-2" variant="destructive">{messageRequests.length}</Badge>
                </h3>
                {messageRequests.map((userData) => {
                  const displayName = userData.first_name && userData.last_name
                    ? `${userData.first_name} ${userData.last_name}`
                    : userData.username;

                  return (
                    <div
                      key={userData.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${selectedConversation?.user.id === userData.id ? 'bg-primary/10' : ''
                        }`}
                      onClick={() => startConversation(userData)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={userData.profile_picture_url} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{displayName}</p>
                          <p className="text-sm text-muted-foreground">@{userData.username}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleFollow(userData.id)}
                          disabled={isFollowLoading[userData.id]}
                        >
                          {followStatus[userData.id] ? 'Unfollow' : 'Follow'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Mutual Follows Section */}
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Conversations</h3>
              {filteredUsers.map((userData) => {
                const displayName = userData.first_name && userData.last_name
                  ? `${userData.first_name} ${userData.last_name}`
                  : userData.username;

                return (
                  <div
                    key={userData.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${selectedConversation?.user.id === userData.id ? 'bg-primary/10' : ''
                      }`}
                    onClick={() => startConversation(userData)}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={userData.profile_picture_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{displayName}</p>
                        <p className="text-sm text-muted-foreground">@{userData.username}</p>
                      </div>
                      {!followedUsers.some(u => u.id === userData.id) && (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.user.profile_picture_url} />
                    <AvatarFallback className="bg-primary text-foreground">
                      {(selectedConversation.user.first_name?.[0] || selectedConversation.user.username[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {selectedConversation.user.first_name && selectedConversation.user.last_name
                        ? `${selectedConversation.user.first_name} ${selectedConversation.user.last_name}`
                        : selectedConversation.user.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">@{selectedConversation.user.username}</p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {loading && (
                      <>
                        <MessageSkeleton />
                        <MessageSkeleton />
                        <MessageSkeleton />
                      </>
                    )}

                    {messages.map((message) => (
                      <div
                        key={`${message.type}-${message.id}`}
                        className={`flex group ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-xs lg:max-w-md relative">
                          <div
                            className={`px-4 py-2 rounded-2xl relative ${message.sender_id === user.id
                                ? 'bg-primary text-primary-foreground ml-auto'
                                : 'bg-muted text-foreground'
                              }`}
                          >
                            {renderMessageContent(message)}

                            <div className="flex items-center justify-between mt-1">
                              <p
                                className={`text-xs ${message.sender_id === user.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}
                              >
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </p>
                              {message.sender_id === user.id && message.type === 'message' && (
                                <div className="ml-2">
                                  {message.is_read ? (
                                    <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                                  ) : (
                                    <Check className="h-3 w-3 text-primary-foreground/70" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Message reactions */}
                          {message.type === 'message' && messageReactions[message.id] && (
                            <div className="mt-1">
                              <MessageReactions
                                messageId={message.id}
                                reactions={messageReactions[message.id] || []}
                                onReactionUpdate={() => fetchMessageReactions([message.id])}
                              />
                            </div>
                          )}

                          {/* Message actions */}
                          {message.type === 'message' && (
                            <div
                              className={`absolute -top-2 ${message.sender_id === user.id ? 'left-2' : 'right-2'
                                } opacity-0 group-hover:opacity-100 transition-opacity`}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 bg-background shadow-sm border border-border"
                                  >
                                    <MoreVertical className="h-3 w-3 text-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </DropdownMenuItem>
                                  {message.sender_id === user.id && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setEditingMessage(message.id);
                                          setEditedContent(message.content || '');
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => deleteForEveryone(message.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete for Everyone
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {replyingTo && (
                      <div className="bg-primary/10 p-3 rounded-xl border border-primary/20 mx-4">
                        <p className="text-sm text-primary font-medium mb-1">Replying to:</p>
                        <p className="text-sm text-foreground">{replyingTo.content}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingTo(null)}
                          className="mt-2 h-6 px-2 text-xs text-primary hover:text-primary/80"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}

                    {isTyping && (
                      <div className="flex justify-start p-4">
                        <div className="bg-muted px-4 py-2 rounded-xl">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                              style={{ animationDelay: '0.1s' }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                              style={{ animationDelay: '0.2s' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-muted rounded-xl p-2 px-3">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        debouncedHandleTyping();
                      }}
                      onKeyPress={handleKeyPress}
                      className="border-none bg-transparent p-0 text-sm focus:ring-0 placeholder-muted-foreground"
                      disabled={loading}
                    />
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || loading}
                    className="rounded-full w-8 h-8 p-0 bg-primary hover:bg-primary/90 disabled:bg-muted"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/30">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Your Messages</h3>
                <p className="text-sm text-muted-foreground">Send private messages to a friend or follow.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramMessages;