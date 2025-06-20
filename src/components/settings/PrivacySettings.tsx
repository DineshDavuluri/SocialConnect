
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface PrivacySettingsProps {
  onSettingsChange?: () => void;
}

const PrivacySettings = ({ onSettingsChange }: PrivacySettingsProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    private_account: false,
    show_activity_status: true,
    allow_story_mentions: true,
    allow_message_requests: true,
    hide_last_seen: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPrivacySettings();
  }, [user]);

  const fetchPrivacySettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('privacy_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching privacy settings:', error);
      } else if (data?.privacy_settings) {
        const privacySettings = data.privacy_settings as Record<string, any>;
        setSettings(prev => ({ ...prev, ...privacySettings }));
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    }
  };

  const updatePrivacySettings = async (newSettings: typeof settings) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ privacy_settings: newSettings as Json })
        .eq('id', user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update privacy settings",
          variant: "destructive",
        });
      } else {
        setSettings(newSettings);
        onSettingsChange?.();
        toast({
          title: "Success",
          description: "Privacy settings updated",
        });
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    updatePrivacySettings(newSettings);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="private-account" className="flex flex-col space-y-1">
            <span>Private Account</span>
            <span className="text-sm text-muted-foreground">
              Only your followers can see your posts
            </span>
          </Label>
          <Switch
            id="private-account"
            checked={settings.private_account}
            onCheckedChange={() => handleToggle('private_account')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="activity-status" className="flex flex-col space-y-1">
            <span>Show Activity Status</span>
            <span className="text-sm text-muted-foreground">
              Let others see when you're active
            </span>
          </Label>
          <Switch
            id="activity-status"
            checked={settings.show_activity_status}
            onCheckedChange={() => handleToggle('show_activity_status')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="story-mentions" className="flex flex-col space-y-1">
            <span>Allow Story Mentions</span>
            <span className="text-sm text-muted-foreground">
              Let others mention you in their stories
            </span>
          </Label>
          <Switch
            id="story-mentions"
            checked={settings.allow_story_mentions}
            onCheckedChange={() => handleToggle('allow_story_mentions')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="message-requests" className="flex flex-col space-y-1">
            <span>Allow Message Requests</span>
            <span className="text-sm text-muted-foreground">
              Let non-followers send you messages
            </span>
          </Label>
          <Switch
            id="message-requests"
            checked={settings.allow_message_requests}
            onCheckedChange={() => handleToggle('allow_message_requests')}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hide-last-seen" className="flex flex-col space-y-1">
            <span>Hide Last Seen</span>
            <span className="text-sm text-muted-foreground">
              Don't show when you were last active
            </span>
          </Label>
          <Switch
            id="hide-last-seen"
            checked={settings.hide_last_seen}
            onCheckedChange={() => handleToggle('hide_last_seen')}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;
