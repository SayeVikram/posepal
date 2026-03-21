import { TimelineEntry } from '@/services/mockData';

interface Props {
  timeline: TimelineEntry[];
  className?: string;
}

const CorrectnessTimeline = ({ timeline, className = '' }: Props) => {
  if (!timeline.length) return null;
  const maxTime = timeline[timeline.length - 1].timestamp;

  return (
    <div className={`flex h-6 w-full overflow-hidden rounded-md ${className}`}>
      {timeline.map((entry, i) => (
        <div
          key={i}
          className={`flex-1 transition-colors ${entry.isCorrect ? 'bg-success' : 'bg-destructive'}`}
          title={`${entry.timestamp.toFixed(1)}s — ${entry.isCorrect ? 'Correct' : 'Incorrect'}`}
        />
      ))}
    </div>
  );
};

export default CorrectnessTimeline;
