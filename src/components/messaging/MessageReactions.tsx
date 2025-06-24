
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MessageReactionsProps {
  messageId: string;
  reactions: any[];
  onReactionUpdate: () => void;
}

const MessageReactions = ({ messageId, reactions, onReactionUpdate }: MessageReactionsProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const reactionEmojis = ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

  const addReaction = async (reactionType: string) => {
    if (!user) return;

    try {
      // Check if user already reacted
      const existingReaction = reactions.find(r => r.user_id === user.id);

      if (existingReaction) {
        // Update existing reaction
        await supabase
          .from('message_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existingReaction.id);
      } else {
        // Add new reaction
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            reaction_type: reactionType
          });
      }

      onReactionUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({
        title: "Error",
        description: "Failed to add reaction",
        variant: "destructive",
      });
    }
  };

  const removeReaction = async () => {
    if (!user) return;

    try {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      onReactionUpdate();
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const userReaction = reactions.find(r => r.user_id === user?.id);
  const reactionCounts = reactions.reduce((acc: Record<string, number>, reaction) => {
    acc[reaction.reaction_type] = (acc[reaction.reaction_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex items-center space-x-1 mt-1">
      {Object.entries(reactionCounts).map(([emoji, count]) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs bg-white/90 hover:bg-white border border-gray-200 rounded-full shadow-sm"
          onClick={() => userReaction?.reaction_type === emoji ? removeReaction() : addReaction(emoji)}
        >
          {emoji} {String(count)}
        </Button>
      ))}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-white/90 hover:bg-white border border-gray-200 rounded-full shadow-sm">
            😊
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-white border border-gray-200 rounded-2xl shadow-lg">
          <div className="flex space-x-1">
            {reactionEmojis.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                onClick={() => addReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
