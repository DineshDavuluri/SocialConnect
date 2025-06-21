import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MapPin, Link as LinkIcon, Calendar, Edit, Settings, Grid, Heart, Bookmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/post/PostCard';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  profile_picture_url: string;
  location: string;
  website_url: string;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserPosts();
      fetchLikedPosts();
      fetchSavedPosts();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserPosts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchLikedPosts = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('likes')
        .select(`
          *,
          posts (
            *,
            users (
              id,
              username,
              first_name,
              last_name,
              profile_picture_url,
              is_verified
            )
          )
        `)
        .eq('user_id', user.id)
        .not('post_id', 'is', null)
        .order('created_at', { ascending: false });

      setLikedPosts(data?.map(like => like.posts).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    }
  };

  const fetchSavedPosts = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('saved_posts')
        .select(`
          *,
          posts (
            *,
            users (
              id,
              username,
              first_name,
              last_name,
              profile_picture_url,
              is_verified
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setSavedPosts(data?.map(saved => saved.posts).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchProfile();
    fetchUserPosts();
    fetchLikedPosts();
    fetchSavedPosts();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return <div>Profile not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile.profile_picture_url} />
                <AvatarFallback className="text-2xl">
                  {profile.first_name?.charAt(0) || profile.username?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold">{profile.username}</h1>
                    {profile.is_verified && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-6 text-sm">
                  <span><strong>{posts.length}</strong> posts</span>
                  <span><strong>{profile.followers_count || 0}</strong> followers</span>
                  <span><strong>{profile.following_count || 0}</strong> following</span>
                </div>

                <div className="space-y-2">
                  {(profile.first_name || profile.last_name) && (
                    <p className="font-semibold">
                      {profile.first_name} {profile.last_name}
                    </p>
                  )}
                  {profile.bio && <p className="text-muted-foreground">{profile.bio}</p>}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {profile.location && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{profile.location}</span>
                      </div>
                    )}
                    {profile.website_url && (
                      <div className="flex items-center space-x-1">
                        <LinkIcon className="h-4 w-4" />
                        <a href={profile.website_url} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          {profile.website_url}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {format(new Date(profile.created_at), 'MMMM yyyy')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Profile Content */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="posts">
              <Grid className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="liked">
              <Heart className="h-4 w-4 mr-2" />
              Liked
            </TabsTrigger>
            <TabsTrigger value="saved">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onLike={refreshData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="liked" className="mt-6">
            {likedPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No liked posts yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {likedPosts.map((post) => (
                  <PostCard key={post.id} post={post} onLike={refreshData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            {savedPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No saved posts yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedPosts.map((post) => (
                  <PostCard key={post.id} post={post} onLike={refreshData} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
