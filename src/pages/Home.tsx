
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import EnhancedStoriesBar from '@/components/stories/EnhancedStoriesBar';
import Feed from '@/components/feed/Feed';
import TrendingPanel from '@/components/home/TrendingPanel';

const Home = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your feed...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // AuthForm will be shown by App.tsx
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <EnhancedStoriesBar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <main className="lg:col-span-3">
            <Feed />
          </main>
          <aside className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-6">
              <TrendingPanel />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Home;
