
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface NotificationSettingsProps {
  onSettingsChange?: () => void;
}

const NotificationSettings = ({ onSettingsChange }: NotificationSettingsProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    likes_comments: true,
    new_followers: true,
    direct_messages: true,
    story_views: false,
    post_shares: true,
    message_reactions: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotificationSettings();
  }, [user]);

  const fetchNotificationSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('notification_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching notification settings:', error);
      } else if (data?.notification_settings) {
        const notificationSettings = data.notification_settings as Record<string, any>;
        setSettings(prev => ({ ...prev, ...notificationSettings }));
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const updateNotificationSettings = async (newSettings: typeof settings) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ notification_settings: newSettings as Json })
        .eq('id', user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update notification settings",
          variant: "destructive",
        });
      } else {
        setSettings(newSettings);
        onSettingsChange?.();
        toast({
          title: "Success",
          description: "Notification settings updated",
        });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    updateNotificationSettings(newSettings);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="likes-comments" className="flex flex-col space-y-1">
            <span>Likes & Comments</span>
            <span className="text-sm text-muted-foreground">
              Get notified when someone likes or comments on your posts
            </span>
          </Label>
          <Switch
            id="likes-comments"
            checked={settings.likes_comments}
            onCheckedChange={() => handleToggle('likes_comments')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="new-followers" className="flex flex-col space-y-1">
            <span>New Followers</span>
            <span className="text-sm text-muted-foreground">
              Get notified when someone follows you
            </span>
          </Label>
          <Switch
            id="new-followers"
            checked={settings.new_followers}
            onCheckedChange={() => handleToggle('new_followers')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="direct-messages" className="flex flex-col space-y-1">
            <span>Direct Messages</span>
            <span className="text-sm text-muted-foreground">
              Get notified when you receive new messages
            </span>
          </Label>
          <Switch
            id="direct-messages"
            checked={settings.direct_messages}
            onCheckedChange={() => handleToggle('direct_messages')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="story-views" className="flex flex-col space-y-1">
            <span>Story Views</span>
            <span className="text-sm text-muted-foreground">
              Get notified when someone views your stories
            </span>
          </Label>
          <Switch
            id="story-views"
            checked={settings.story_views}
            onCheckedChange={() => handleToggle('story_views')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="post-shares" className="flex flex-col space-y-1">
            <span>Post Shares</span>
            <span className="text-sm text-muted-foreground">
              Get notified when someone shares your posts
            </span>
          </Label>
          <Switch
            id="post-shares"
            checked={settings.post_shares}
            onCheckedChange={() => handleToggle('post_shares')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="message-reactions" className="flex flex-col space-y-1">
            <span>Message Reactions</span>
            <span className="text-sm text-muted-foreground">
              Get notified when someone reacts to your messages
            </span>
          </Label>
          <Switch
            id="message-reactions"
            checked={settings.message_reactions}
            onCheckedChange={() => handleToggle('message_reactions')}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
