
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Heart,
  Star,
  Camera,
  Mic
} from 'lucide-react';

interface AdvancedStoryEditorProps {
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
  rotation?: number;
}

interface StickerOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation?: number;
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
  preview_url?: string;
}

const AdvancedStoryEditor: React.FC<AdvancedStoryEditorProps> = ({ isOpen, onClose, onStoryCreated }) => {
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
  const [fontFamily, setFontFamily] = useState('Arial');
  
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
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
      color: textColor,
      fontSize: fontSize[0],
      fontFamily: fontFamily,
      backgroundColor: textBgColor === 'transparent' ? undefined : textBgColor,
      rotation: 0
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
      size: 40,
      rotation: 0
    };

    setStickerOverlays(prev => [...prev, overlay]);
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

  const selectMusic = (music: MusicSelection) => {
    setSelectedMusic(music);
    setCurrentTool(null);
  };

  const applyFilter = (filter: string) => {
    setCurrentFilter(filter);
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
            backgroundColor: overlay.backgroundColor,
            rotation: overlay.rotation
          })),
          stickerOverlays: stickerOverlays.map(overlay => ({
            id: overlay.id,
            emoji: overlay.emoji,
            x: overlay.x,
            y: overlay.y,
            size: overlay.size,
            rotation: overlay.rotation
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
          duration: selectedMusic.duration,
          preview_url: selectedMusic.preview_url
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

  const emojiList = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😴', '🎉', '❤️', '👍', '🔥', '💯', '⭐', '🌟', '🎵', '🎶', '🌈', '🦄', '🍕', '🎂'];
  const gifList = [
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif'
  ];
  const musicList: MusicSelection[] = [
    { title: 'Summer Vibes', artist: 'Artist 1', duration: 30 },
    { title: 'Chill Beat', artist: 'Artist 2', duration: 45 },
    { title: 'Happy Days', artist: 'Artist 3', duration: 60 }
  ];
  const filtersList = [
    { name: 'None', value: 'none' },
    { name: 'Sepia', value: 'sepia(100%)' },
    { name: 'Grayscale', value: 'grayscale(100%)' },
    { name: 'Blur', value: 'blur(2px)' },
    { name: 'Brightness', value: 'brightness(120%)' },
    { name: 'Contrast', value: 'contrast(120%)' },
    { name: 'Vintage', value: 'sepia(50%) contrast(120%) brightness(90%)' }
  ];
  const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Comic Sans MS', 'Impact'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 h-[90vh] overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Create Advanced Story</DialogTitle>
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
                    backgroundColor: overlay.backgroundColor,
                    padding: overlay.backgroundColor ? '4px 8px' : '0',
                    borderRadius: overlay.backgroundColor ? '4px' : '0',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    transform: `rotate(${overlay.rotation || 0}deg)`
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
                    fontSize: `${overlay.size}px`,
                    transform: `rotate(${overlay.rotation || 0}deg)`
                  }}
                  onClick={() => removeStickerOverlay(overlay.id)}
                >
                  {overlay.emoji}
                </div>
              ))}

              {/* GIF Overlays */}
              {gifOverlays.map((overlay) => (
                <img
                  key={overlay.id}
                  src={overlay.url}
                  alt="GIF"
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${overlay.x}px`,
                    top: `${overlay.y}px`,
                    width: `${overlay.size}px`,
                    height: `${overlay.size}px`,
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                  onClick={() => removeGifOverlay(overlay.id)}
                />
              ))}

              {/* Music Display */}
              {selectedMusic && (
                <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-2 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Music className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-white text-sm">
                    <p className="font-medium">{selectedMusic.title}</p>
                    <p className="text-xs opacity-80">{selectedMusic.artist}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-white hover:bg-white/20"
                    onClick={() => setSelectedMusic(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

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
                  onClick={() => setCurrentTool(currentTool === 'sticker' ? null : 'sticker')}
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
            <div className="p-4 bg-gray-50 dark:bg-gray-900 space-y-3 max-h-48 overflow-y-auto">
              <Input
                placeholder="Enter text..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Text Color</label>
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-8 p-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Background</label>
                  <Input
                    type="color"
                    value={textBgColor === 'transparent' ? '#000000' : textBgColor}
                    onChange={(e) => setTextBgColor(e.target.value)}
                    className="w-full h-8 p-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Font Size: {fontSize[0]}px</label>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  max={48}
                  min={12}
                  step={2}
                />
              </div>
              <select 
                value={fontFamily} 
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full p-2 rounded border"
              >
                {fontFamilies.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
              <Button onClick={addTextOverlay} className="w-full">
                Add Text
              </Button>
            </div>
          )}

          {currentTool === 'sticker' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 max-h-48 overflow-y-auto">
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
            <div className="p-4 bg-gray-50 dark:bg-gray-900 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {gifList.map((gif, index) => (
                  <img
                    key={index}
                    src={gif}
                    alt={`GIF ${index}`}
                    className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={() => addGifOverlay(gif)}
                  />
                ))}
              </div>
            </div>
          )}

          {currentTool === 'music' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {musicList.map((music, index) => (
                  <div
                    key={index}
                    className="p-2 border rounded cursor-pointer hover:bg-muted/50"
                    onClick={() => selectMusic(music)}
                  >
                    <p className="font-medium text-sm">{music.title}</p>
                    <p className="text-xs text-muted-foreground">{music.artist} • {music.duration}s</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTool === 'filter' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {filtersList.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={currentFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyFilter(filter.value)}
                    className="text-xs"
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

export default AdvancedStoryEditor;
