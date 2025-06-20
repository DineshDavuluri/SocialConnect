
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import PostCard from '@/components/post/PostCard';

const Saved = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSavedPosts();
    }
  }, [user]);

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

      setSavedPosts(data || []);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Saved Posts</h1>

        {savedPosts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No saved posts yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Save posts by clicking the bookmark icon
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {savedPosts.map((savedPost) => (
              <PostCard 
                key={savedPost.id} 
                post={savedPost.posts} 
                onLike={fetchSavedPosts} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Saved;
