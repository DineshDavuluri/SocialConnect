
import React, { useState, useEffect, useRef } from 'react';
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
  MessageCircle 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import MessageReactions from './MessageReactions';

const InstagramMessages = () => {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (user) {
      fetchFollowedUsers();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.user.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchFollowedUsers = async () => {
    if (!user) return;

    try {
      console.log('Fetching followed users for user:', user.id);
      
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error fetching followed users:', error);
        toast({
          title: "Error",
          description: "Failed to load conversations",
          variant: "destructive",
        });
      } else {
        console.log('Followed users data:', data);
        const followedUsersData = data?.map(follow => follow.users).filter(Boolean) || [];
        setFollowedUsers(followedUsersData);
      }
    } catch (error) {
      console.error('Error fetching followed users:', error);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;
    
    setLoading(true);

    try {
      console.log('Fetching messages between:', user.id, 'and:', otherUserId);
      
      // Fetch messages with simpler query to avoid schema cache issues
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
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

      // Fetch sender data separately to avoid join issues
      const senderIds = [...new Set([...messagesData.map(m => m.sender_id), otherUserId, user.id])];
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, profile_picture_url')
        .in('id', senderIds);

      if (usersError) {
        console.error('Error fetching users data:', usersError);
      }

      // Create a map of users for quick lookup
      const usersMap = usersData?.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>) || {};

      // Fetch reply-to messages separately
      const replyToIds = messagesData.filter(m => m.reply_to).map(m => m.reply_to);
      let replyMessagesMap = {};
      
      if (replyToIds.length > 0) {
        const { data: replyMessages, error: replyError } = await supabase
          .from('messages')
          .select('id, content, sender_id')
          .in('id', replyToIds);

        if (!replyError && replyMessages) {
          replyMessagesMap = replyMessages.reduce((acc, msg) => {
            acc[msg.id] = {
              ...msg,
              sender: usersMap[msg.sender_id]
            };
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Fetch shared posts separately  
      const { data: sharedPostsData, error: sharedPostsError } = await supabase
        .from('post_shares')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      // Fetch posts data for shares
      let postsMap = {};
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

          if (!postsError && postsData) {
            // Fetch post authors
            const postUserIds = [...new Set(postsData.map(p => p.user_id))];
            const { data: postUsersData } = await supabase
              .from('users')
              .select('id, username, first_name, last_name, profile_picture_url')
              .in('id', postUserIds);

            const postUsersMap = postUsersData?.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {} as Record<string, any>) || {};

            postsMap = postsData.reduce((acc, post) => {
              acc[post.id] = {
                ...post,
                users: postUsersMap[post.user_id]
              };
              return acc;
            }, {} as Record<string, any>);
          }
        }
      }

      console.log('Messages data:', messagesData);
      console.log('Shared posts data:', sharedPostsData);

      // Enhance messages with user data and replies
      const enhancedMessages = messagesData.map(msg => ({
        ...msg,
        type: 'message',
        sender: usersMap[msg.sender_id],
        reply_to_message: msg.reply_to ? replyMessagesMap[msg.reply_to] : null
      }));

      // Enhance shared posts with sender and post data
      const enhancedShares = (sharedPostsData || []).map(share => ({
        ...share,
        type: 'shared_post',
        sender: usersMap[share.sender_id],
        post: share.post_id ? postsMap[share.post_id] : null
      }));

      // Combine and sort all conversation history by timestamp
      const combinedData = [
        ...enhancedMessages,
        ...enhancedShares
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      console.log('Combined conversation history:', combinedData);
      setMessages(combinedData);

      // Fetch reactions for all messages
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
      setLoading(false);
    }
  };

  const fetchMessageReactions = async (messageIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (error) {
        console.error('Error fetching reactions:', error);
      } else {
        const groupedReactions = data?.reduce((acc, reaction) => {
          if (!acc[reaction.message_id]) {
            acc[reaction.message_id] = [];
          }
          acc[reaction.message_id].push(reaction);
          return acc;
        }, {} as Record<string, any[]>) || {};
        
        setMessageReactions(groupedReactions);
      }
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) {
      return;
    }

    try {
      console.log('Sending message:', newMessage);
      
      const messageData = {
        sender_id: user.id,
        receiver_id: selectedConversation.user.id,
        content: newMessage.trim(),
        reply_to: replyingTo?.id || null,
        is_read: false,
        is_deleted: false,
        deleted_for_everyone: false
      };

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error",
          description: `Failed to send message: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Message sent successfully');
        setNewMessage('');
        setReplyingTo(null);
        setIsTyping(false);
        await fetchMessages(selectedConversation.user.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

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
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) {
        console.error('Error editing message:', error);
        toast({
          title: "Error",
          description: "Failed to edit message",
          variant: "destructive",
        });
      } else {
        setEditingMessage(null);
        setEditedContent('');
        await fetchMessages(selectedConversation.user.id);
        toast({
          title: "Success",
          description: "Message edited successfully",
        });
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const deleteForEveryone = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          deleted_for_everyone: true,
          deleted_for_everyone_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) {
        console.error('Error deleting message for everyone:', error);
        toast({
          title: "Error",
          description: "Failed to delete message",
          variant: "destructive",
        });
      } else {
        await fetchMessages(selectedConversation.user.id);
        toast({
          title: "Success",
          description: "Message deleted for everyone",
        });
      }
    } catch (error) {
      console.error('Error deleting message for everyone:', error);
    }
  };

  const renderMessageContent = (message: any) => {
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
          {message.message && (
            <p className="text-sm mb-2">{message.message}</p>
          )}
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
                {formatDistanceToNow(new Date(message.post.created_at), { addSuffix: true })}
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

  const startConversation = (userData: any) => {
    setSelectedConversation({ user: userData });
    setMessages([]);
  };

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
          </div>
          <ScrollArea className="h-full">
            <div className="space-y-0">
              {followedUsers.map((userData) => {
                const displayName = userData.first_name && userData.last_name
                  ? `${userData.first_name} ${userData.last_name}`
                  : userData.username;

                return (
                  <div
                    key={userData.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${
                      selectedConversation?.user.id === userData.id ? 'bg-primary/10' : ''
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
                    <AvatarFallback className="bg-primary text-primary-foreground">
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
                      <div className="text-center text-muted-foreground">
                        Loading conversation history...
                      </div>
                    )}
                    
                    {replyingTo && (
                      <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
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
                    
                    {messages.map((message) => (
                      <div
                        key={`${message.type}-${message.id}`}
                        className={`flex group ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-xs lg:max-w-md relative">
                          <div
                            className={`px-4 py-2 rounded-2xl relative ${
                              message.sender_id === user.id
                                ? 'bg-primary text-primary-foreground ml-auto'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {renderMessageContent(message)}
                            
                            <div className="flex items-center justify-between mt-1">
                              <p className={`text-xs ${
                                message.sender_id === user.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}>
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
                            <div className={`absolute -top-2 ${message.sender_id === user.id ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 bg-background shadow-sm border border-border">
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
                                      <DropdownMenuItem onClick={() => {
                                        setEditingMessage(message.id);
                                        setEditedContent(message.content);
                                      }}>
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
                    
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted px-4 py-2 rounded-2xl">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-muted rounded-full px-4 py-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={handleKeyPress}
                      className="border-none bg-transparent p-0 focus:ring-0 placeholder-muted-foreground"
                      disabled={loading}
                    />
                  </div>
                  <Button 
                    onClick={sendMessage} 
                    disabled={!newMessage.trim() || loading}
                    className="rounded-full w-10 h-10 p-0 bg-primary hover:bg-primary/90 disabled:bg-muted"
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
                <p className="text-muted-foreground">Send private messages to a friend or group.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramMessages;
