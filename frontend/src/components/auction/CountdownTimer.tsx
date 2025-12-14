import { useCountdown } from '@/hooks/use-countDown';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  endDate: string | Date;
  className?: string;
  variant?: 'default' | 'compact' | 'large';
}

export function CountdownTimer({ endDate, className, variant = 'default' }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired, totalSeconds } = useCountdown(new Date(endDate));

  if (isExpired) {
    return (
      <div className={cn('text-destructive font-medium', className)}>
        Auction Ended
      </div>
    );
  }

  const isUrgent = totalSeconds < 3600; // Less than 1 hour

  if (variant === 'compact') {
    return (
      <div className={cn('font-mono text-sm', isUrgent && 'text-destructive', className)}>
        {days > 0 && `${days}d `}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div className={cn('flex gap-4', className)}>
        {days > 0 && (
          <TimeBlock value={days} label="Days" isUrgent={isUrgent} />
        )}
        <TimeBlock value={hours} label="Hours" isUrgent={isUrgent} />
        <TimeBlock value={minutes} label="Minutes" isUrgent={isUrgent} />
        <TimeBlock value={seconds} label="Seconds" isUrgent={isUrgent} />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 font-mono', isUrgent && 'text-destructive', className)}>
      {days > 0 && <span>{days}d</span>}
      <span>{String(hours).padStart(2, '0')}</span>:
      <span>{String(minutes).padStart(2, '0')}</span>:
      <span>{String(seconds).padStart(2, '0')}</span>
    </div>
  );
}

function TimeBlock({ value, label, isUrgent }: { value: number; label: string; isUrgent: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold bg-muted',
          isUrgent && 'bg-destructive/10 text-destructive'
        )}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}
