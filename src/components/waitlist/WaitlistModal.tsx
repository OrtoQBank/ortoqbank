'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { X } from 'lucide-react';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { api } from '../../../convex/_generated/api';

const RESIDENCY_LEVELS = ['R1', 'R2', 'R3', 'Já concluí'] as const;
const SUBSPECIALTIES = [
  'Pediátrica',
  'Tumor',
  'Quadril',
  'Joelho',
  'Ombro e Cotovelo',
  'Mão',
  'Coluna',
  'Pé e Tornozelo',
] as const;

const waitlistFormSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  whatsapp: z.string().min(10, 'WhatsApp deve ter pelo menos 10 dígitos'),
  instagram: z.string().optional(),
  residencyLevel: z.enum(RESIDENCY_LEVELS, {
    required_error: 'Selecione o nível da residência',
  }),
  subspecialty: z.enum(SUBSPECIALTIES, {
    required_error: 'Selecione a subespecialidade',
  }),
});

type WaitlistFormValues = z.infer<typeof waitlistFormSchema>;

export function WaitlistModal() {
  const [isOpen, setIsOpen] = useQueryState(
    'waitlist',
    parseAsBoolean.withDefault(false)
  );
  const createWaitlistEntry = useMutation(api.waitlist.createWaitlistEntry);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setIsOpen(false);
  };

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      name: '',
      email: '',
      whatsapp: '',
      instagram: '',
    },
  });

  const onSubmit = async (values: WaitlistFormValues) => {
    setError(null);

    try {
      await createWaitlistEntry({
        name: values.name,
        email: values.email,
        whatsapp: values.whatsapp,
        instagram: values.instagram || undefined,
        residencyLevel: values.residencyLevel,
        subspecialty: values.subspecialty,
      });

      setSubmitSuccess(true);

      setTimeout(() => {
        form.reset();
        setSubmitSuccess(false);
        handleClose();
      }, 2000);
      
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Erro ao enviar formulário');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>

        {submitSuccess ? (
          <div className="py-8 text-center">
            <div className="mb-4 text-5xl">✓</div>
            <h2 className="mb-2 text-2xl font-bold text-brand-blue">
              Cadastro realizado!
            </h2>
            <p className="text-gray-600">
              Você será notificado quando abrirmos novas turmas.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">
              Preencha os campos para confirmar sua vaga!
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              Seus dados estão seguros.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="* Nome"
                          className="border-brand-blue focus:ring-brand-blue"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="* E-mail"
                          className="border-brand-blue focus:ring-brand-blue"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="* WhatsApp"
                          className="border-brand-blue focus:ring-brand-blue"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Instagram (@)"
                          className="border-brand-blue focus:ring-brand-blue"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="residencyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-brand-blue focus:ring-brand-blue">
                            <SelectValue placeholder="* Nível atual na Residência" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESIDENCY_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subspecialty"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-brand-blue focus:ring-brand-blue">
                            <SelectValue placeholder="* Subespecialidade que deseja seguir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUBSPECIALTIES.map((specialty) => (
                            <SelectItem key={specialty} value={specialty}>
                              {specialty}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full bg-brand-blue py-6 text-lg font-semibold uppercase text-white hover:bg-brand-blue/80"
                >
                  {form.formState.isSubmitting ? 'Enviando...' : 'Entrar para lista VIP'}
                </Button>

                <p className="text-center text-xs text-gray-500">
                  Seus dados estão seguros.
                  <br />
                  Política de Privacidade e Termos de Uso
                </p>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}

