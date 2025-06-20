import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { 
  Type, 
  Palette, 
  Music, 
  Smile,
  Download,
  X,
  Sparkles,
  Camera,
  Mic
} from 'lucide-react';

interface StoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  backgroundColor?: string;
}

interface StickerOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

interface GifOverlay {
  id: string;
  url: string;
  x: number;
  y: number;
  size: number;
}

interface MusicSelection {
  title: string;
  artist: string;
  duration: number;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ isOpen, onClose, onStoryCreated }) => {
  const { user } = useAuth();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [stickerOverlays, setStickerOverlays] = useState<StickerOverlay[]>([]);
  const [gifOverlays, setGifOverlays] = useState<GifOverlay[]>([]);
  const [currentTool, setCurrentTool] = useState<'text' | 'sticker' | 'music' | 'gif' | 'filter' | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicSelection | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('none');
  
  // Text editing states
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBgColor, setTextBgColor] = useState('transparent');
  const [fontSize, setFontSize] = useState([24]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 50MB",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;

    const overlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 50,
      color: textColor,
      fontSize: fontSize[0],
      fontFamily: 'Arial',
      backgroundColor: textBgColor === 'transparent' ? undefined : textBgColor
    };

    setTextOverlays(prev => [...prev, overlay]);
    setNewText('');
    setCurrentTool(null);
  };

  const addStickerOverlay = (emoji: string) => {
    const overlay: StickerOverlay = {
      id: Date.now().toString(),
      emoji,
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
      size: 40
    };

    setStickerOverlays(prev => [...prev, overlay]);
    setCurrentTool(null);
  };

  const addGifOverlay = (gifUrl: string) => {
    const overlay: GifOverlay = {
      id: Date.now().toString(),
      url: gifUrl,
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
      size: 100
    };

    setGifOverlays(prev => [...prev, overlay]);
    setCurrentTool(null);
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id));
  };

  const removeStickerOverlay = (id: string) => {
    setStickerOverlays(prev => prev.filter(overlay => overlay.id !== id));
  };

  const removeGifOverlay = (id: string) => {
    setGifOverlays(prev => prev.filter(overlay => overlay.id !== id));
  };

  const handlePublishStory = async () => {
    if (!user || !mediaFile) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const storyData = {
          textOverlays: textOverlays.map(overlay => ({
            id: overlay.id,
            text: overlay.text,
            x: overlay.x,
            y: overlay.y,
            color: overlay.color,
            fontSize: overlay.fontSize,
            fontFamily: overlay.fontFamily,
            backgroundColor: overlay.backgroundColor
          })),
          stickerOverlays: stickerOverlays.map(overlay => ({
            id: overlay.id,
            emoji: overlay.emoji,
            x: overlay.x,
            y: overlay.y,
            size: overlay.size
          })),
          gifOverlays: gifOverlays.map(overlay => ({
            id: overlay.id,
            url: overlay.url,
            x: overlay.x,
            y: overlay.y,
            size: overlay.size
          })),
          filters: { current: currentFilter }
        };

        const musicData = selectedMusic ? {
          title: selectedMusic.title,
          artist: selectedMusic.artist,
          duration: selectedMusic.duration
        } : {};

        const { error } = await supabase
          .from('stories')
          .insert({
            user_id: user.id,
            media_url: base64,
            media_type: mediaFile.type.startsWith('video/') ? 'video' : 
                       mediaFile.type.startsWith('audio/') ? 'audio' : 'image',
            content: caption,
            story_data: storyData as any,
            music_data: musicData as any,
            filters: { current: currentFilter } as any
          });

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: "Story published successfully!",
        });

        resetEditor();
        onStoryCreated();
        onClose();
      };
      reader.readAsDataURL(mediaFile);
    } catch (error) {
      console.error('Error publishing story:', error);
      toast({
        title: "Error",
        description: "Failed to publish story",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetEditor = () => {
    setMediaFile(null);
    setMediaPreview('');
    setCaption('');
    setTextOverlays([]);
    setStickerOverlays([]);
    setGifOverlays([]);
    setSelectedMusic(null);
    setCurrentFilter('none');
    setCurrentTool(null);
    setNewText('');
  };

  const emojiList = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😴', '🎉', '❤️', '👍', '🔥', '💯', '⭐', '🌟', '🎵', '🎶'];
  const gifList = [
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif'
  ];
  const musicList: MusicSelection[] = [
    { title: 'Summer Vibes', artist: 'Artist 1', duration: 30 },
    { title: 'Chill Beat', artist: 'Artist 2', duration: 45 }
  ];
  const filtersList = [
    { name: 'None', value: 'none' },
    { name: 'Sepia', value: 'sepia(100%)' },
    { name: 'Grayscale', value: 'grayscale(100%)' },
    { name: 'Blur', value: 'blur(2px)' },
    { name: 'Brightness', value: 'brightness(120%)' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 h-[90vh] overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!mediaFile ? (
            <div className="p-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="story-media"
                />
                <label htmlFor="story-media" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="flex justify-center space-x-4">
                      <Camera className="h-12 w-12 text-gray-400" />
                      <Mic className="h-12 w-12 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">Upload photo, video, or audio</p>
                    <p className="text-xs text-gray-400">Max 50MB</p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="relative bg-black h-[60vh] overflow-hidden">
              {mediaFile.type.startsWith('video/') ? (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={mediaPreview}
                  className="w-full h-full object-cover"
                  style={{ filter: currentFilter !== 'none' ? currentFilter : undefined }}
                  controls={false}
                  muted
                />
              ) : mediaFile.type.startsWith('audio/') ? (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <audio
                    src={mediaPreview}
                    className="w-3/4"
                    controls
                  />
                </div>
              ) : (
                <img
                  ref={mediaRef as React.RefObject<HTMLImageElement>}
                  src={mediaPreview}
                  alt="Story preview"
                  className="w-full h-full object-cover"
                  style={{ filter: currentFilter !== 'none' ? currentFilter : undefined }}
                />
              )}

              {/* Text Overlays */}
              {textOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${overlay.x}px`,
                    top: `${overlay.y}px`,
                    color: overlay.color,
                    fontSize: `${overlay.fontSize}px`,
                    fontFamily: overlay.fontFamily,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                  }}
                  onClick={() => removeTextOverlay(overlay.id)}
                >
                  {overlay.text}
                </div>
              ))}

              {/* Sticker Overlays */}
              {stickerOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${overlay.x}px`,
                    top: `${overlay.y}px`,
                    fontSize: `${overlay.size}px`
                  }}
                  onClick={() => removeStickerOverlay(overlay.id)}
                >
                  {overlay.emoji}
                </div>
              ))}

              {/* Gif Overlays */}
              {gifOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${overlay.x}px`,
                    top: `${overlay.y}px`,
                    width: `${overlay.size}px`,
                    height: `${overlay.size}px`
                  }}
                  onClick={() => removeGifOverlay(overlay.id)}
                >
                  <img
                    src={overlay.url}
                    alt="Gif"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}

              {/* Tools Bar */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 bg-black/50 rounded-full p-2">
                <Button
                  size="icon"
                  variant={currentTool === 'text' ? 'default' : 'ghost'}
                  onClick={() => setCurrentTool(currentTool === 'text' ? null : 'text')}
                >
                  <Type className="h-4 w-4 text-white" />
                </Button>
                <Button
                  size="icon"
                  variant={currentTool === 'sticker' ? 'default' : 'ghost'}
                  onClick={() => setCurrentTool(currentTool === 'sticker' ?  null : 'sticker')}
                >
                  <Smile className="h-4 w-4 text-white" />
                </Button>
                <Button
                  size="icon"
                  variant={currentTool === 'gif' ? 'default' : 'ghost'}
                  onClick={() => setCurrentTool(currentTool === 'gif' ? null : 'gif')}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </Button>
                <Button
                  size="icon"
                  variant={currentTool === 'music' ? 'default' : 'ghost'}
                  onClick={() => setCurrentTool(currentTool === 'music' ? null : 'music')}
                >
                  <Music className="h-4 w-4 text-white" />
                </Button>
                <Button
                  size="icon"
                  variant={currentTool === 'filter' ? 'default' : 'ghost'}
                  onClick={() => setCurrentTool(currentTool === 'filter' ? null : 'filter')}
                >
                  <Palette className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>
          )}

          {/* Tool Panels */}
          {currentTool === 'text' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
              <Input
                placeholder="Enter text..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <div className="flex items-center space-x-3">
                <Input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-8 p-1"
                />
                <div className="flex-1">
                  <Slider
                    value={fontSize}
                    onValueChange={setFontSize}
                    max={48}
                    min={12}
                    step={2}
                  />
                </div>
                <Button size="sm" onClick={addTextOverlay}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {currentTool === 'sticker' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-8 gap-2">
                {emojiList.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="sm"
                    onClick={() => addStickerOverlay(emoji)}
                    className="text-2xl h-12"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {currentTool === 'gif' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-4 gap-2">
                {gifList.map((gifUrl) => (
                  <Button
                    key={gifUrl}
                    variant="ghost"
                    size="sm"
                    onClick={() => addGifOverlay(gifUrl)}
                    className="text-2xl h-12"
                  >
                    <img
                      src={gifUrl}
                      alt="Gif"
                      className="w-full h-full object-cover"
                    />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {currentTool === 'music' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm text-muted-foreground text-center">
                Music feature coming soon...
              </p>
            </div>
          )}

          {currentTool === 'filter' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-4 gap-2">
                {filtersList.map((filter) => (
                  <Button
                    key={filter.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentFilter(filter.value)}
                    className="text-2xl h-12"
                  >
                    {filter.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Caption and Publish */}
          {mediaFile && (
            <div className="p-4 space-y-3">
              <Textarea
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
              />
              <div className="flex space-x-2">
                <Button variant="outline" onClick={resetEditor} className="flex-1">
                  Reset
                </Button>
                <Button 
                  onClick={handlePublishStory} 
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {loading ? 'Publishing...' : 'Publish Story'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryEditor;
