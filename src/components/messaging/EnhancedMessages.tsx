
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  Send, 
  Phone, 
  Video, 
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

const EnhancedMessages = () => {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({});

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

  const fetchFollowedUsers = async () => {
    if (!user) return;

    try {
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
      } else {
        const followedUsersData = data?.map(follow => follow.users).filter(Boolean) || [];
        setFollowedUsers(followedUsersData);
      }
    } catch (error) {
      console.error('Error fetching followed users:', error);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    try {
      // Fetch regular messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, username, first_name, last_name, profile_picture_url),
          reply_to_message:messages!messages_reply_to_fkey(id, content, sender_id)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .eq('is_deleted', false)
        .eq('deleted_for_everyone', false)
        .order('created_at', { ascending: true });

      // Fetch shared posts
      const { data: sharedPostsData, error: sharedPostsError } = await supabase
        .from('post_shares')
        .select(`
          *,
          sender:users!post_shares_sender_id_fkey(id, username, first_name, last_name, profile_picture_url),
          post:posts!post_shares_post_id_fkey(
            id,
            content,
            media_urls,
            type,
            likes_count,
            comments_count,
            created_at,
            user_id,
            users(id, username, first_name, last_name, profile_picture_url)
          )
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      }

      if (sharedPostsError) {
        console.error('Error fetching shared posts:', sharedPostsError);
      }

      // Combine and sort messages and shared posts by timestamp
      const combinedData = [
        ...(messagesData || []).map(msg => ({ ...msg, type: 'message' })),
        ...(sharedPostsData || []).map(share => ({ ...share, type: 'shared_post' }))
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(combinedData);

      // Fetch reactions for messages
      if (messagesData && messagesData.length > 0) {
        fetchMessageReactions(messagesData.map(m => m.id));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
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
        deleted_for_everyone: false
      };

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
      } else {
        setNewMessage('');
        setReplyingTo(null);
        fetchMessages(selectedConversation.user.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
        fetchMessages(selectedConversation.user.id);
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
        fetchMessages(selectedConversation.user.id);
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
            <div className="border rounded-lg p-3 bg-muted/30">
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
          <div className="border rounded-lg p-3 bg-muted/30">
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
          <div className="text-xs opacity-70 mb-1 p-2 bg-black/10 rounded">
            Replying to: {message.reply_to_message.content}
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
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={() => editMessage(message.id, editedContent)}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingMessage(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm">{message.content}</p>
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
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Following Users List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm">Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 p-2">
                  {followedUsers.map((userData) => {
                    const displayName = userData.first_name && userData.last_name
                      ? `${userData.first_name} ${userData.last_name}`
                      : userData.username;

                    return (
                      <div
                        key={userData.id}
                        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
                        onClick={() => startConversation(userData)}
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={userData.profile_picture_url} />
                            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            <p className="text-sm text-muted-foreground">@{userData.username}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">Following</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="md:col-span-2 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={selectedConversation.user.profile_picture_url} />
                        <AvatarFallback>
                          {(selectedConversation.user.first_name?.[0] || selectedConversation.user.username[0]).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium">
                          {selectedConversation.user.first_name && selectedConversation.user.last_name
                            ? `${selectedConversation.user.first_name} ${selectedConversation.user.last_name}`
                            : selectedConversation.user.username}
                        </h3>
                        <p className="text-sm text-muted-foreground">@{selectedConversation.user.username}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {replyingTo && (
                        <div className="bg-muted p-3 rounded-lg border-l-4 border-primary">
                          <p className="text-sm text-muted-foreground">Replying to:</p>
                          <p className="text-sm">{replyingTo.content}</p>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setReplyingTo(null)}
                            className="mt-1"
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
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                              message.sender_id === user.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
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
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <Check className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Message reactions */}
                            {message.type === 'message' && messageReactions[message.id] && (
                              <MessageReactions
                                messageId={message.id}
                                reactions={messageReactions[message.id] || []}
                                onReactionUpdate={() => fetchMessageReactions([message.id])}
                              />
                            )}

                            {/* Message actions */}
                            {message.type === 'message' && (
                              <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                      <MoreVertical className="h-3 w-3" />
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
                    </div>
                  </ScrollArea>
                </CardContent>

                <div className="p-4 border-t">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Select a user to start messaging</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMessages;
