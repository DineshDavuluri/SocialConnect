import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Video, X, Smile } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MediaUploadProps {
  onMediaSelect: (media: { type: 'image' | 'video'; url: string; file: File }[]) => void;
  onEmojiClick?: (emoji: string) => void;
}

const emojiSections = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊']
  },
  {
    name: 'Reactions',
    icon: '❤️',
    emojis: ['❤️', '💛', '💚', '💙', '💜', '💯', '🔥', '🎉', '👏', '🙌']
  },
  {
    name: 'Spiritual',
    icon: '🔱',
    emojis: ['🔱', '🕉️', '☸️', '📿', '🛕', '🧘‍♂️', '🧘‍♀️', '🙏', '🪔', '🪷']
  },
  {
    name: 'Hands',
    icon: '👍',
    emojis: ['👍', '👎', '👊', '✊', '🙏', '👏', '🙌', '🤝', '🤲']
  }
];

const MediaUpload: React.FC<MediaUploadProps> = ({ onMediaSelect, onEmojiClick }) => {
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'image' | 'video'; url: string; file: File }[]>([]);
  const [activeSection, setActiveSection] = useState(emojiSections[0]);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select files smaller than 10MB',
          variant: 'destructive',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const type: 'image' | 'video' = file.type.startsWith('image/') ? 'image' : 'video';

        const newMedia = { type, url, file };
        setSelectedMedia((prev) => {
          const updated = [...prev, newMedia];
          onMediaSelect(updated);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index: number) => {
    setSelectedMedia((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onMediaSelect(updated);
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Image className="h-4 w-4 mr-2" /> Photos
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Video className="h-4 w-4 mr-2" /> Videos
        </Button>

        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="peer">
            <Smile className="h-4 w-4 mr-2" /> Emoji
          </Button>

          <div className="absolute top-full left-0 mt-2 p-2 bg-background border rounded-lg shadow-lg z-10 hidden peer-focus:block hover:block w-[250px]">
            <div className="flex justify-between mb-2">
              {emojiSections.map((section) => (
                <button
                  key={section.name}
                  onClick={() => setActiveSection(section)}
                  className={`text-xl px-2 ${activeSection.name === section.name ? 'bg-muted rounded' : ''}`}
                >
                  {section.icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 border rounded mb-2 text-sm text-black"
            />
            <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto">
              {(activeSection.emojis.filter((e) => e.includes(search))).map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  className="p-2 hover:bg-muted rounded text-lg"
                  onClick={() => onEmojiClick?.(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedMedia.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {selectedMedia.map((media, index) => (
            <div key={index} className="relative">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 z-10"
                onClick={() => removeMedia(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              {media.type === 'image' ? (
                <img
                  src={media.url}
                  alt="Selected media"
                  className="w-full h-32 object-cover rounded-lg"
                />
              ) : (
                <video
                  src={media.url}
                  className="w-full h-32 object-cover rounded-lg"
                  controls
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUpload;