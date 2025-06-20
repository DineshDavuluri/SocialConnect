
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { 
  Upload, 
  Image, 
  Video, 
  Music, 
  Palette, 
  Sparkles, 
  Smile,
  Type,
  Filter,
  Volume2,
  X,
  Check
} from 'lucide-react';

interface EnhancedStoryUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
}

const EnhancedStoryUpload = ({ isOpen, onClose, onStoryCreated }: EnhancedStoryUploadProps) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Story enhancement states
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [brightness, setBrightness] = useState([100]);
  const [contrast, setContrast] = useState([100]);
  const [saturation, setSaturation] = useState([100]);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
  const [textOverlays, setTextOverlays] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    size: number;
  }>>([]);
  const [stickers, setStickers] = useState<Array<{
    id: string;
    emoji: string;
    x: number;
    y: number;
    size: number;
  }>>([]);

  const filters = [
    { name: 'None', value: 'none', style: {} },
    { name: 'Vintage', value: 'vintage', style: { filter: 'sepia(0.5) contrast(1.2)' } },
    { name: 'B&W', value: 'bw', style: { filter: 'grayscale(1)' } },
    { name: 'Warm', value: 'warm', style: { filter: 'hue-rotate(15deg) saturate(1.2)' } },
    { name: 'Cool', value: 'cool', style: { filter: 'hue-rotate(-15deg) saturate(0.8)' } },
    { name: 'Dramatic', value: 'dramatic', style: { filter: 'contrast(1.5) brightness(0.9)' } }
  ];

  const musicTracks = [
    { name: 'Upbeat Pop', id: 'upbeat-pop' },
    { name: 'Chill Vibes', id: 'chill-vibes' },
    { name: 'Acoustic', id: 'acoustic' },
    { name: 'Electronic', id: 'electronic' }
  ];

  const emojis = ['😀', '😍', '🔥', '💯', '✨', '❤️', '👍', '🎉', '😎', '🌟', '💫', '🦋'];

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now().toString(),
      text: 'Your text here',
      x: 50,
      y: 50,
      color: '#ffffff',
      size: 24
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const addSticker = (emoji: string) => {
    const newSticker = {
      id: Date.now().toString(),
      emoji,
      x: Math.random() * 70 + 15,
      y: Math.random() * 70 + 15,
      size: 32
    };
    setStickers([...stickers, newSticker]);
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter(overlay => overlay.id !== id));
  };

  const removeSticker = (id: string) => {
    setStickers(stickers.filter(sticker => sticker.id !== id));
  };

  const handleCreateStory = async () => {
    if (!user || !selectedFile) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const storyData = {
          filters: {
            selected: selectedFilter,
            brightness: brightness[0],
            contrast: contrast[0],
            saturation: saturation[0]
          },
          textOverlays,
          stickers,
          music: selectedMusic
        };

        const { error } = await supabase
          .from('stories')
          .insert({
            user_id: user.id,
            media_url: base64,
            media_type: selectedFile.type.startsWith('video/') ? 'video' : 'image',
            content: caption,
            story_data: storyData,
            music_data: selectedMusic ? { track: selectedMusic } : {},
            filters: {
              selected: selectedFilter,
              brightness: brightness[0],
              contrast: contrast[0],
              saturation: saturation[0]
            }
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
          onStoryCreated();
          handleClose();
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error creating story:', error);
      toast({
        title: "Error",
        description: "Failed to create story",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setSelectedFilter('none');
    setBrightness([100]);
    setContrast([100]);
    setSaturation([100]);
    setSelectedMusic(null);
    setTextOverlays([]);
    setStickers([]);
    onClose();
  };

  const getFilterStyle = () => {
    const baseFilter = filters.find(f => f.value === selectedFilter)?.style.filter || '';
    const customFilter = `brightness(${brightness[0]}%) contrast(${contrast[0]}%) saturate(${saturation[0]}%)`;
    return baseFilter ? `${baseFilter} ${customFilter}` : customFilter;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Create Your Story
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[80vh]">
          {/* Preview Section */}
          <div className="space-y-4">
            <Card className="aspect-[9/16] max-h-[500px] overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
              <CardContent className="p-0 h-full relative">
                {preview ? (
                  <div className="relative h-full">
                    {selectedFile?.type.startsWith('video/') ? (
                      <video
                        src={preview}
                        className="w-full h-full object-cover"
                        style={{ filter: getFilterStyle() }}
                        muted
                        loop
                        autoPlay
                      />
                    ) : (
                      <img
                        src={preview}
                        alt="Story preview"
                        className="w-full h-full object-cover"
                        style={{ filter: getFilterStyle() }}
                      />
                    )}
                    
                    {/* Text Overlays */}
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className="absolute cursor-move"
                        style={{
                          left: `${overlay.x}%`,
                          top: `${overlay.y}%`,
                          color: overlay.color,
                          fontSize: `${overlay.size}px`,
                          fontWeight: 'bold',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                        }}
                      >
                        {overlay.text}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => removeTextOverlay(overlay.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Stickers */}
                    {stickers.map((sticker) => (
                      <div
                        key={sticker.id}
                        className="absolute cursor-move"
                        style={{
                          left: `${sticker.x}%`,
                          top: `${sticker.y}%`,
                          fontSize: `${sticker.size}px`
                        }}
                      >
                        {sticker.emoji}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs"
                          onClick={() => removeSticker(sticker.id)}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 p-8">
                    <div className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                      <Upload className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-lg font-medium text-center">Upload your media</p>
                    <p className="text-sm text-muted-foreground text-center">
                      Choose an image or video to create your story
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Controls Section with ScrollArea */}
          <div className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic"><Image className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="filters"><Filter className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="text"><Type className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="stickers"><Smile className="h-4 w-4" /></TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <TabsContent value="basic" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Caption</label>
                    <Textarea
                      placeholder="Write a caption for your story..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Volume2 className="h-4 w-4" /> Background Music
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {musicTracks.map((track) => (
                          <Button
                            key={track.id}
                            variant={selectedMusic === track.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedMusic(selectedMusic === track.id ? null : track.id)}
                            className="justify-start"
                          >
                            <Music className="h-3 w-3 mr-2" />
                            {track.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="filters" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filters</label>
                    <div className="grid grid-cols-3 gap-2">
                      {filters.map((filter) => (
                        <Button
                          key={filter.value}
                          variant={selectedFilter === filter.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedFilter(filter.value)}
                        >
                          {filter.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Brightness: {brightness[0]}%</label>
                      <Slider
                        value={brightness}
                        onValueChange={setBrightness}
                        max={200}
                        min={0}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Contrast: {contrast[0]}%</label>
                      <Slider
                        value={contrast}
                        onValueChange={setContrast}
                        max={200}
                        min={0}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Saturation: {saturation[0]}%</label>
                      <Slider
                        value={saturation}
                        onValueChange={setSaturation}
                        max={200}
                        min={0}
                        step={5}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4 mt-0">
                  <Button onClick={addTextOverlay} className="w-full">
                    <Type className="h-4 w-4 mr-2" />
                    Add Text
                  </Button>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {textOverlays.map((overlay) => (
                      <Card key={overlay.id}>
                        <CardContent className="p-3 space-y-2">
                          <Input
                            value={overlay.text}
                            onChange={(e) => {
                              const updated = textOverlays.map(o => 
                                o.id === overlay.id ? { ...o, text: e.target.value } : o
                              );
                              setTextOverlays(updated);
                            }}
                            placeholder="Enter text"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={overlay.color}
                              onChange={(e) => {
                                const updated = textOverlays.map(o => 
                                  o.id === overlay.id ? { ...o, color: e.target.value } : o
                                );
                                setTextOverlays(updated);
                              }}
                              className="w-8 h-8 rounded"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeTextOverlay(overlay.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="stickers" className="space-y-4 mt-0">
                  <div className="grid grid-cols-6 gap-2">
                    {emojis.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="outline"
                        size="sm"
                        onClick={() => addSticker(emoji)}
                        className="text-2xl p-2 h-12"
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                  
                  {stickers.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Added Stickers:</label>
                      <div className="flex flex-wrap gap-2">
                        {stickers.map((sticker) => (
                          <Badge key={sticker.id} variant="secondary" className="text-lg">
                            {sticker.emoji}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-1 h-4 w-4 p-0"
                              onClick={() => removeSticker(sticker.id)}
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateStory} 
                disabled={loading || !selectedFile}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {loading ? (
                  "Creating..."
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Story
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedStoryUpload;
