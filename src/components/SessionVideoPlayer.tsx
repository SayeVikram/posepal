import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface Props {
  url: string;
}

const SessionVideoPlayer = forwardRef<VideoPlayerHandle, Props>(({ url }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = seconds;
      v.play().catch(() => {});
    },
  }));

  return (
    <Card className="overflow-hidden border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Video className="h-4 w-4 text-primary" />
          Session Recording
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <video
          ref={videoRef}
          src={url}
          controls
          className="w-full rounded-b-lg bg-black"
          style={{ maxHeight: 440 }}
        />
      </CardContent>
    </Card>
  );
});

SessionVideoPlayer.displayName = 'SessionVideoPlayer';
export default SessionVideoPlayer;
