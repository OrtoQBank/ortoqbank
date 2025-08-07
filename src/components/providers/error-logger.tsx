'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function ErrorLogger() {
  useEffect(() => {
    const handleImageError = (event: Event) => {
      const target = event.target as HTMLElement;

      if (
        target instanceof HTMLImageElement &&
        target.src.includes('imagekit.io')
      ) {
        Sentry.captureMessage('Image failed to load', {
          level: 'error',
          extra: {
            src: target.src,
            alt: target.alt,
            currentUrl: globalThis.location.href,
            userAgent: navigator.userAgent,
          },
        });
      }
    };

    globalThis.addEventListener('error', handleImageError, true);

    return () => {
      globalThis.removeEventListener('error', handleImageError, true);
    };
  }, []);

  return null;
}
