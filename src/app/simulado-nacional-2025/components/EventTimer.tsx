'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EventTimerProps {
  expiresAt: number;
  onExpired: () => void;
}

export default function EventTimer({ expiresAt, onExpired }: EventTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, expiresAt - now);

      if (diff === 0) {
        onExpired();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, total: diff });
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  const isLowTime = timeLeft.total < 30 * 60 * 1000; // Less than 30 minutes
  const isCriticalTime = timeLeft.total < 10 * 60 * 1000; // Less than 10 minutes

  return (
    <div className="flex items-center gap-2">
      {isCriticalTime && (
        <AlertTriangle className="h-4 w-4 animate-pulse text-red-500" />
      )}
      <Clock className="h-4 w-4" />
      <Badge
        variant={
          isCriticalTime ? 'destructive' : isLowTime ? 'outline' : 'secondary'
        }
        className={`font-mono text-sm ${isCriticalTime ? 'animate-pulse' : ''}`}
      >
        {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:
        {formatTime(timeLeft.seconds)}
      </Badge>
      {isLowTime && !isCriticalTime && (
        <span className="text-xs text-orange-600">Atenção!</span>
      )}
      {isCriticalTime && (
        <span className="text-xs font-bold text-red-600">Tempo acabando!</span>
      )}
    </div>
  );
}
