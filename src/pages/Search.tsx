import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search as SearchIcon, Users, Hash, UserPlus } from 'lucide-react';
import PostCard from '@/components/post/PostCard';

const Search = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(20);

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          users (
            id,
            username,
            first_name,
            last_name,
            profile_picture_url,
            is_verified
          )
        `)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      const hashtagMatches = postsData?.reduce((acc: { tag: string; count: number }[], post) => {
        const matches = post.content?.match(/#\w+/g) || [];
        matches.forEach((tag: string) => {
          const cleanTag = tag.toLowerCase();
          if (cleanTag.includes(searchQuery.toLowerCase())) {
            const existing = acc.find(item => item.tag === cleanTag);
            if (existing) {
              existing.count++;
            } else {
              acc.push({ tag: cleanTag, count: 1 });
            }
          }
        });
        return acc;
      }, []);

      setUsers(usersData || []);
      setPosts(postsData || []);
      setHashtags(hashtagMatches || []);
      await fetchFollowStatus(usersData || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowStatus = async (usersList: any[]) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', usersList.map((u) => u.id));

    if (error) {
      console.error('Error fetching follow status:', error.message);
      return;
    }

    const map: Record<string, boolean> = {};
    data?.forEach((row) => {
      map[row.following_id] = true;
    });
    setFollowMap(map);
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!user || user.id === targetUserId) return;

    setFollowLoadingMap((prev) => ({ ...prev, [targetUserId]: true }));

    const isFollowing = followMap[targetUserId];

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        setFollowMap((prev) => ({ ...prev, [targetUserId]: false }));
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: targetUserId });

        setFollowMap((prev) => ({ ...prev, [targetUserId]: true }));

        await supabase.from('notifications').insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'follow',
          message: 'started following you',
        });
      }
    } catch (err) {
      console.error('Follow/unfollow error:', err);
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
      performSearch(query);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search users, posts, hashtags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Users ({users.length})
              </TabsTrigger>
              <TabsTrigger value="posts">
                Posts ({posts.length})
              </TabsTrigger>
              <TabsTrigger value="hashtags">
                <Hash className="h-4 w-4 mr-2" />
                Hashtags ({hashtags.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4 mt-6">
              {users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No users found</p>
              ) : (
                users.map((searchUser) => (
                  <Card key={searchUser.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={searchUser.profile_picture_url} />
                          <AvatarFallback>{searchUser.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold">{searchUser.username}</p>
                            {searchUser.is_verified && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                Verified
                              </Badge>
                            )}
                          </div>
                          {(searchUser.first_name || searchUser.last_name) && (
                            <p className="text-sm text-muted-foreground">
                              {searchUser.first_name} {searchUser.last_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {searchUser.followers_count || 0} followers
                          </p>
                        </div>
                      </div>
                      {user && user.id !== searchUser.id && (
                        <Button
                          variant={followMap[searchUser.id] ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => toggleFollow(searchUser.id)}
                          disabled={followLoadingMap[searchUser.id]}
                          className={`rounded-full px-4 ${followMap[searchUser.id]
                              ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                            }`}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {followMap[searchUser.id] ? 'Following' : 'Follow'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="posts" className="space-y-4 mt-6">
              {posts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No posts found</p>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} onLike={() => performSearch(query)} />
                ))
              )}
            </TabsContent>

            <TabsContent value="hashtags" className="space-y-4 mt-6">
              {hashtags.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hashtags found</p>
              ) : (
                hashtags.map((hashtag, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-lg">{hashtag.tag}</p>
                          <p className="text-sm text-muted-foreground">{hashtag.count} posts</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Follow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Search;
