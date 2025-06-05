'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  state: 'idle' | 'loading' | 'success' | 'error';
  message: {
    title: string;
    description: string;
  };
};

export function FeedbackModal({
  isOpen,
  onClose,
  state,
  message,
}: FeedbackModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          {state === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <DialogTitle>Criando seu quiz...</DialogTitle>
              <DialogDescription>
                Estamos preparando seu teste personalizado. Você será
                redirecionado automaticamente assim que estiver pronto.
              </DialogDescription>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <DialogTitle>{message.title}</DialogTitle>
              <DialogDescription>{message.description}</DialogDescription>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <DialogTitle>{message.title}</DialogTitle>
              <DialogDescription>{message.description}</DialogDescription>
              <Button onClick={onClose} variant="outline">
                Fechar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
