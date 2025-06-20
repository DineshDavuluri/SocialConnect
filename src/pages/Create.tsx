
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreatePost from '@/components/post/CreatePost';

const Create = () => {
  const handlePostCreated = () => {
    // Post creation feedback
    console.log('Post created successfully');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create New Post</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePost onPostCreated={handlePostCreated} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Create;
