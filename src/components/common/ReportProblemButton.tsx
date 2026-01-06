'use client';

import { useMutation } from 'convex/react';
import { AlertTriangle, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface ReportProblemButtonProps {
  questionId: Id<'questions'>;
  questionCode?: string;
  className?: string;
}

export default function ReportProblemButton({
  questionId,
  questionCode,
  className = 'rounded-full p-2 hover:bg-gray-100',
}: ReportProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitReport = useMutation(api.questionErrorReport.submitReport);
  const generateUploadUrl = useMutation(
    api.questionErrorReport.generateUploadUrl,
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const removeScreenshot = () => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Por favor, descreva o problema encontrado.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotStorageId: Id<'_storage'> | undefined;

      // Upload screenshot if provided
      if (screenshotFile) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': screenshotFile.type },
          body: screenshotFile,
        });

        if (!response.ok) {
          throw new Error('Failed to upload screenshot');
        }

        const { storageId } = await response.json();
        screenshotStorageId = storageId;
      }

      await submitReport({
        questionId,
        description: description.trim(),
        screenshotStorageId,
      });

      toast({
        title: 'Problema reportado',
        description:
          'Obrigado por nos ajudar a melhorar! Sua reportagem será analisada.',
      });

      // Reset form and close dialog
      setDescription('');
      removeScreenshot();
      setOpen(false);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setDescription('');
      removeScreenshot();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className={className}
          aria-label="Reportar problema"
          title="Reportar problema com esta questão"
        >
          <AlertTriangle className="h-5 w-5 text-gray-400 hover:text-amber-500" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reportar Problema
          </DialogTitle>
          <DialogDescription>
            {questionCode
              ? `Questão: ${questionCode}`
              : 'Descreva o problema encontrado nesta questão.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium"
            >
              Descrição do problema *
            </label>
            <Textarea
              id="description"
              placeholder="Ex: A alternativa C está marcada como correta, mas deveria ser a alternativa A..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Captura de tela (opcional)
            </label>

            {screenshotPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="max-h-40 w-full rounded-md border object-contain"
                />
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                <ImagePlus className="h-5 w-5" />
                <span>Clique para adicionar imagem</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Relatório'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
