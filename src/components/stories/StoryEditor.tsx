import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Camera,
  Sparkles
} from 'lucide-react';
import { debounce } from 'lodash';
import { Json } from '@/integrations/supabase/types';

interface StoryInsert {
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  content?: string | null;
  story_data?: Json | null;
  music_data?: Json | null;
}

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

interface DraggableOverlayProps {
  overlay: TextOverlay | StickerOverlay | GifOverlay;
  updatePosition: (id: string, x: number, y: number, type: string) => void;
  children: React.ReactNode;
  onRemove: (id: string) => void;
  type: 'text' | 'sticker' | 'gif';
}

const DraggableOverlay: React.FC<DraggableOverlayProps> = React.memo(({
  overlay,
  updatePosition,
  children,
  onRemove,
  type
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - overlay.x,
      y: e.clientY - overlay.y,
    };
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      updatePosition(overlay.id, newX, newY, type);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onRemove(overlay.id);
    }
  };

  return (
    <div
      className="absolute cursor-move select-none"
      style={{
        left: `${overlay.x}px`,
        top: `${overlay.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        e.stopPropagation();
        onRemove(overlay.id);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Remove ${type} overlay`}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
});

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
  const [fileLoading, setFileLoading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicSelection | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('none');

  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBgColor, setTextBgColor] = useState('transparent');
  const [fontSize, setFontSize] = useState([24]);
  const [fontFamily, setFontFamily] = useState('Arial');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const debouncedUpdatePosition = useCallback(
    debounce((id: string, x: number, y: number, type: string) => {
      switch (type) {
        case 'text':
          setTextOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, x, y } : o
          ));
          break;
        case 'sticker':
          setStickerOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, x, y } : o
          ));
          break;
        case 'gif':
          setGifOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, x, y } : o
          ));
          break;
      }
    }, 50),
    []
  );

  const validateFile = (file: File): boolean => {
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/webm'
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Format",
        description: "Please upload a JPEG, PNG, GIF, MP4, or WebM file.",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 50MB.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !validateFile(file)) return;

    setFileLoading(true);
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    setFileLoading(false);
  };

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mediaPreview]);

  useEffect(() => {
    if (!canvasRef.current || !mediaRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 600;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mediaRef.current instanceof HTMLImageElement || mediaRef.current instanceof HTMLVideoElement) {
        ctx.filter = currentFilter;
        ctx.drawImage(mediaRef.current, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      }

      textOverlays.forEach(overlay => {
        ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
        if (overlay.backgroundColor) {
          ctx.fillStyle = overlay.backgroundColor;
          ctx.fillRect(
            overlay.x - 2,
            overlay.y - overlay.fontSize,
            ctx.measureText(overlay.text).width + 4,
            overlay.fontSize + 4
          );
          ctx.fillStyle = overlay.color;
        } else {
          ctx.fillStyle = overlay.color;
        }
        ctx.fillText(overlay.text, overlay.x, overlay.y);
      });

      stickerOverlays.forEach(overlay => {
        ctx.font = `${overlay.size}px Arial`;
        ctx.fillText(overlay.emoji, overlay.x, overlay.y);
      });

      gifOverlays.forEach(overlay => {
        const img = new Image();
        img.src = overlay.url;
        ctx.drawImage(img, overlay.x, overlay.y, overlay.size, overlay.size);
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    if (mediaRef.current instanceof HTMLVideoElement) {
      mediaRef.current.play().catch(() => { });
    }

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRef.current instanceof HTMLVideoElement) {
        mediaRef.current.pause();
      }
    };
  }, [mediaPreview, textOverlays, stickerOverlays, gifOverlays, currentFilter]);

  const addTextOverlay = () => {
    if (!newText.trim()) {
      toast({
        title: "Empty Text",
        description: "Please enter some text to add.",
        variant: "destructive",
      });
      return;
    }

    const overlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 50,
      color: textColor,
      fontSize: fontSize[0],
      fontFamily,
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
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to publish a story.",
        variant: "destructive",
      });
      return;
    }
    if (!mediaFile) {
      toast({
        title: "Media Required",
        description: "Please select an image or video file.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;

          const dataSize = new TextEncoder().encode(JSON.stringify({
            storyData: { textOverlays, stickerOverlays, gifOverlays, filter: currentFilter },
            musicData: selectedMusic,
            media: base64
          })).length;

          if (dataSize > 10 * 1024 * 1024) {
            throw new Error("Story data exceeds 10MB limit.");
          }

          let lastError: Error | null = null;
          for (let i = 0; i < 3; i++) {
            try {
              const storyData: StoryInsert = {
                user_id: user.id,
                media_url: base64,
                media_type: mediaFile.type.startsWith('video/') ? 'video' : 'image',
                content: caption || null,
                story_data: {
                  textOverlays,
                  stickerOverlays,
                  gifOverlays,
                  filter: currentFilter,
                } as unknown as Json,
                music_data: (selectedMusic || null) as unknown as Json,
              };

              const { error } = await supabase
                .from('stories')
                .insert([storyData]);

              if (!error) {
                toast({
                  title: "Success",
                  description: "Story published successfully!",
                });
                resetEditor();
                onStoryCreated();
                onClose();
                return;
              }

              lastError = error;
              toast({
                title: "Retrying",
                description: `Attempt ${i + 1} failed: ${error.message}. Retrying...`,
                variant: "destructive",
              });
            } catch (err) {
              lastError = err as Error;
            }
          }
          throw new Error(lastError?.message || "Failed to publish story after retries.");
        } catch (error: any) {
          throw new Error(error.message || "Failed to process story data.");
        }
      };
      reader.onerror = () => {
        throw new Error("Failed to read media file.");
      };
      reader.readAsDataURL(mediaFile);
    } catch (error: any) {
      console.error('Error publishing story:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while publishing the story.",
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
    setTextColor('#ffffff');
    setTextBgColor('transparent');
    setFontSize([24]);
    setFontFamily('Arial');
  };

  const emojiList = ['😀', '😂', '😍', '�0', '😎', '🤔', '😴', '🎉', '❤️', '👍', '🔥', '💯', '⭐', '🌟', '🎵', '🎶'];
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
      <DialogContent className="max-w-md p-0 h-[90vh] overflow-y-auto">
        <div className="flex flex-col h-full">
          <DialogHeader className="p-4 pb-2 text-black sticky top-0 bg-white z-10">
            <DialogTitle>Create Story</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col">
            {fileLoading ? (
              <div className="p-4 flex items-center justify-center flex-1">
                <p className="text-gray-600">Loading media...</p>
              </div>
            ) : !mediaFile ? (
              <div className="p-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,video/mp4,video/webm"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="story-media"
                    aria-label="Upload media file"
                  />
                  <label htmlFor="story-media" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="flex justify-center">
                        <Camera className="h-12 w-12 text-gray-400" />
                      </div>
                      <p className="text-gray-600">Click to upload image or video</p>
                      <p className="text-xs text-gray-400">Max 50MB (JPEG, PNG, GIF, MP4, WebM)</p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="relative bg-black">
                  <canvas ref={canvasRef} className="w-full h-auto" />
                  {mediaFile.type.startsWith('image/') ? (
                    <img ref={mediaRef as React.RefObject<HTMLImageElement>} src={mediaPreview} alt="Preview" className="hidden" />
                  ) : (
                    <video ref={mediaRef as React.RefObject<HTMLVideoElement>} src={mediaPreview} className="hidden" muted loop />
                  )}

                  {textOverlays.map(overlay => (
                    <DraggableOverlay
                      key={overlay.id}
                      overlay={overlay}
                      updatePosition={debouncedUpdatePosition}
                      onRemove={removeTextOverlay}
                      type="text"
                    >
                      <span
                        style={{
                          color: overlay.color,
                          fontSize: overlay.fontSize,
                          fontFamily: overlay.fontFamily,
                          backgroundColor: overlay.backgroundColor || 'transparent',
                          padding: '2px 4px',
                          borderRadius: 4,
                          userSelect: 'none',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {overlay.text}
                      </span>
                    </DraggableOverlay>
                  ))}

                  {stickerOverlays.map(overlay => (
                    <DraggableOverlay
                      key={overlay.id}
                      overlay={overlay}
                      updatePosition={debouncedUpdatePosition}
                      onRemove={removeStickerOverlay}
                      type="sticker"
                    >
                      <span style={{ fontSize: overlay.size, userSelect: 'none' }}>{overlay.emoji}</span>
                    </DraggableOverlay>
                  ))}

                  {gifOverlays.map(overlay => (
                    <DraggableOverlay
                      key={overlay.id}
                      overlay={overlay}
                      updatePosition={debouncedUpdatePosition}
                      onRemove={removeGifOverlay}
                      type="gif"
                    >
                      <img src={overlay.url} alt="GIF" style={{ width: overlay.size, height: overlay.size, pointerEvents: 'none' }} />
                    </DraggableOverlay>
                  ))}

                  <div className="flex justify-around p-2 border-t border-gray-200 bg-grey-300 sticky top-[64px] z-10">
                    <Button variant={currentTool === 'text' ? 'default' : 'ghost'} onClick={() => setCurrentTool(currentTool === 'text' ? null : 'text')} aria-label="Add Text">
                      <Type />
                    </Button>
                    <Button variant={currentTool === 'sticker' ? 'default' : 'ghost'} onClick={() => setCurrentTool(currentTool === 'sticker' ? null : 'sticker')} aria-label="Add Sticker">
                      <Smile />
                    </Button>
                    <Button variant={currentTool === 'music' ? 'default' : 'ghost'} onClick={() => setCurrentTool(currentTool === 'music' ? null : 'music')} aria-label="Add Music">
                      <Music />
                    </Button>
                    <Button variant={currentTool === 'gif' ? 'default' : 'ghost'} onClick={() => setCurrentTool(currentTool === 'gif' ? null : 'gif')} aria-label="Add GIF">
                      <Sparkles />
                    </Button>
                    <Button variant={currentTool === 'filter' ? 'default' : 'ghost'} onClick={() => setCurrentTool(currentTool === 'filter' ? null : 'filter')} aria-label="Apply Filter">
                      <Palette />
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <Textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    rows={2}
                  />
                </div>

                {currentTool === 'text' && (
                  <div className="p-4 space-y-2 border-t border-gray-200">
                    <Textarea
                      value={newText}
                      onChange={e => setNewText(e.target.value)}
                      placeholder="Enter text"
                      rows={3}
                    />
                    <div className="flex space-x-2 items-center">
                      <label className="flex items-center space-x-1">
                        <Palette />
                        <input
                          type="color"
                          value={textColor}
                          onChange={e => setTextColor(e.target.value)}
                          aria-label="Text color"
                          className="w-10 h-6 p-0 border-none"
                        />
                      </label>
                      <label className="flex items-center space-x-1">
                        <Palette />
                        <input
                          type="color"
                          value={textBgColor}
                          onChange={e => setTextBgColor(e.target.value)}
                          aria-label="Text background color"
                          className="w-10 h-6 p-0 border-none"
                        />
                      </label>
                      <label className="flex items-center space-x-1">
                        <Type />
                        <select
                          value={fontFamily}
                          onChange={e => setFontFamily(e.target.value)}
                          aria-label="Font family"
                          className="border text-black rounded p-1"
                        >
                          <option value="Arial">Arial</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Verdana">Verdana</option>
                        </select>
                      </label>
                    </div>
                    <div>
                      <label htmlFor="fontSize" className="block text-sm font-medium text-white">Font Size</label>
                      <Slider
                        id="fontSize"
                        min={12}
                        max={72}
                        value={fontSize}
                        onValueChange={(val) => setFontSize(val)}
                      />
                    </div>
                    <Button className='bg-white text-black' onClick={addTextOverlay} disabled={!newText.trim()}>Add Text</Button>
                  </div>
                )}

                {currentTool === 'sticker' && (
                  <div className="p-4 grid grid-cols-6 gap-2 border-t border-gray-200 overflow-y-auto max-h-60">
                    {emojiList.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => addStickerOverlay(emoji)}
                        className="text-2xl"
                        aria-label={`Add sticker ${emoji}`}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {currentTool === 'gif' && (
                  <div className="p-4 grid grid-cols-2 gap-2 border-t border-gray-200 overflow-y-auto max-h-60">
                    {gifList.map((gifUrl, idx) => (
                      <img
                        key={idx}
                        src={gifUrl}
                        alt="GIF"
                        onClick={() => addGifOverlay(gifUrl)}
                        className="cursor-pointer rounded"
                        width={100}
                        height={100}
                      />
                    ))}
                  </div>
                )}

                {currentTool === 'music' && (
                  <div className="p-4 border-t border-gray-200 overflow-y-auto max-h-60">
                    {musicList.map((music, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded cursor-pointer ${selectedMusic?.title === music.title ? 'bg-blue-200' : 'hover:bg-gray-100'}`}
                        onClick={() => setSelectedMusic(music)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select music ${music.title} by ${music.artist}`}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedMusic(music);
                          }
                        }}
                      >
                        <p className="font-semibold">{music.title}</p>
                        <p className="text-sm text-gray-600">{music.artist} • {music.duration}s</p>
                      </div>
                    ))}
                  </div>
                )}

                {currentTool === 'filter' && (
                  <div className="p-4 flex space-x-2 border-t border-gray-200 overflow-x-auto">
                    {filtersList.map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => setCurrentFilter(filter.value)}
                        className={`p-2 rounded border ${currentFilter === filter.value ? 'border-blue-500' : 'border-transparent'}`}
                        aria-label={`Apply filter ${filter.name}`}
                        type="button"
                      >
                        <div
                          className="w-12 h-20 bg-gray-300 rounded"
                          style={{ filter: filter.value !== 'none' ? filter.value : '' }}
                        />
                        <p className="text-xs mt-1 text-center">{filter.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mediaFile && (
              <div className="p-4 flex justify-between border-t border-gray-200 sticky bottom-0 bg-white z-10">
                <Button
                  className="bg-black text-white hover:bg-gray-700 disabled:opacity-50"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-black text-white hover:bg-gray-700 disabled:opacity-50"
                  onClick={handlePublishStory}
                  disabled={loading}
                >
                  {loading ? 'Publishing...' : 'Publish Story'}
                </Button>

              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryEditor;