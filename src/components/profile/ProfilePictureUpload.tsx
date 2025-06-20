
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Camera, Upload } from 'lucide-react';

interface ProfilePictureUploadProps {
  currentUrl?: string;
  onUploadSuccess: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  currentUrl,
  onUploadSuccess,
  size = 'md'
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32'
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        // Update user profile with new profile picture
        const { error } = await supabase
          .from('users')
          .update({ profile_picture_url: base64 })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        onUploadSuccess(base64);
        toast({
          title: "Success",
          description: "Profile picture updated successfully!",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group">
      <Avatar className={`${sizeClasses[size]} cursor-pointer transition-all hover:opacity-80`}>
        <AvatarImage src={currentUrl} />
        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <Camera className="h-6 w-6" />
        </AvatarFallback>
      </Avatar>
      
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full">
        <label htmlFor="profile-upload" className="cursor-pointer">
          <Upload className="h-6 w-6 text-white" />
          <Input
            id="profile-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureUpload;
