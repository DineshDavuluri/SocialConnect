
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, TrendingUp } from 'lucide-react';

const TrendingPanel = () => {
  const { user } = useAuth();
  const [trendingTopics, setTrendingTopics] = useState<{ tag: string; count: number }[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchTrendingTopics();
    fetchSuggestedUsers();
  }, [user]);

  const fetchTrendingTopics = async () => {
    try {
      // Extract hashtags from recent posts and count them
      const { data: posts } = await supabase
        .from('posts')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(100);

      const hashtagCounts = new Map<string, number>();
      posts?.forEach(post => {
        const hashtags = post.content?.match(/#\w+/g) || [];
        hashtags.forEach((tag: string) => {
          const cleanTag = tag.toLowerCase();
          hashtagCounts.set(cleanTag, (hashtagCounts.get(cleanTag) || 0) + 1);
        });
      });

      const trending = Array.from(hashtagCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      setTrendingTopics(trending);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
    }
  };

  const fetchSuggestedUsers = async () => {
    if (!user) return;

    try {
      // Get users not followed by current user
      const { data: followedUsers } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followedIds = followedUsers?.map(f => f.following_id) || [];
      followedIds.push(user.id); // Exclude current user

      const { data: users } = await supabase
        .from('users')
        .select('*')
        .not('id', 'in', `(${followedIds.join(',')})`)
        .order('followers_count', { ascending: false })
        .limit(3);

      setSuggestedUsers(users || []);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: targetUserId,
        });

      // Get current counts and update them
      const { data: currentUser } = await supabase
        .from('users')
        .select('following_count')
        .eq('id', user.id)
        .single();

      const { data: targetUser } = await supabase
        .from('users')
        .select('followers_count')
        .eq('id', targetUserId)
        .single();

      // Update counts
      await supabase
        .from('users')
        .update({ following_count: (currentUser?.following_count || 0) + 1 })
        .eq('id', user.id);

      await supabase
        .from('users')
        .update({ followers_count: (targetUser?.followers_count || 0) + 1 })
        .eq('id', targetUserId);

      fetchSuggestedUsers();
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Trending Topics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Trending Topics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trending topics yet</p>
          ) : (
            trendingTopics.map((topic, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{topic.tag}</p>
                  <p className="text-sm text-muted-foreground">{topic.count} posts</p>
                </div>
                <Badge variant="secondary">{index + 1}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Suggested Users */}
      <Card>
        <CardHeader>
          <CardTitle>People You May Know</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions available</p>
          ) : (
            suggestedUsers.map((suggestedUser) => {
              const displayName = suggestedUser.first_name && suggestedUser.last_name
                ? `${suggestedUser.first_name} ${suggestedUser.last_name}`
                : suggestedUser.username;

              return (
                <div key={suggestedUser.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={suggestedUser.profile_picture_url} />
                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {suggestedUser.followers_count || 0} followers
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFollow(suggestedUser.id)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Follow
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrendingPanel;
