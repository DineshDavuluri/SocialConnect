
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface CreateStoryProps {
  onStoryCreated: () => void;
}

const CreateStory: React.FC<CreateStoryProps> = ({ onStoryCreated }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user || !mediaFile) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const { error } = await supabase
          .from('stories')
          .insert({
            user_id: user.id,
            media_url: base64,
            media_type: mediaFile.type.startsWith('video/') ? 'video' : 'image',
            content: content.trim(),
          });

        if (error) {
          console.error('Error creating story:', error);
          toast({
            title: "Error",
            description: "Failed to create story",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Story created successfully!",
          });
          setIsOpen(false);
          setContent('');
          setMediaFile(null);
          onStoryCreated();
        }
        setLoading(false);
      };
      reader.readAsDataURL(mediaFile);
    } catch (error) {
      console.error('Error creating story:', error);
      toast({
        title: "Error",
        description: "Failed to create story",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-16 w-16 rounded-full border-2 border-dashed"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Your Story</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setMediaFile(file);
              }
            }}
          />
          <Textarea
            placeholder="Add a caption to your story..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setContent('');
                setMediaFile(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading || !mediaFile}>
              {loading ? 'Creating...' : 'Create Story'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStory;
