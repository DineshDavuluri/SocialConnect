
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';

interface VideoCallProps {
  isIncoming?: boolean;
  callerName?: string;
  onEnd: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({
  isIncoming = false,
  callerName = "Unknown User",
  onEnd,
  onAccept,
  onDecline
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isCallActive, setIsCallActive] = useState(!isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isCallActive) {
      startLocalVideo();
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCallActive]);

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const handleAccept = () => {
    setIsCallActive(true);
    onAccept?.();
  };

  const handleDecline = () => {
    onDecline?.();
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setIsCallActive(false);
    onEnd();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  if (isIncoming && !isCallActive) {
    return (
      <Card className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-lg text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Incoming Call</h2>
            <p className="text-lg text-muted-foreground">{callerName}</p>
          </div>
          
          <div className="flex space-x-4 justify-center">
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16"
              onClick={handleDecline}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
              onClick={handleAccept}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!isCallActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote Video (Main) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
        />
        <div className="absolute top-4 left-4 text-white">
          <p className="text-lg font-semibold">{callerName}</p>
        </div>
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div className="absolute top-4 right-4 w-32 h-24 bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={localVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
        <Button
          size="lg"
          variant={isMuted ? "destructive" : "secondary"}
          className="rounded-full h-12 w-12"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        
        <Button
          size="lg"
          variant={isVideoOff ? "destructive" : "secondary"}
          className="rounded-full h-12 w-12"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        
        <Button
          size="lg"
          variant="secondary"
          className="rounded-full h-12 w-12"
        >
          <Settings className="h-5 w-5" />
        </Button>
        
        <Button
          size="lg"
          variant="destructive"
          className="rounded-full h-12 w-12"
          onClick={handleEndCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;
