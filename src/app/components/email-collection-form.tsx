'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmailCollectionForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    // Add your email registration logic here
    setMessage('Thank you for joining the waitlist!');
  };

  return (
    <form onSubmit={handleEmailRegistration} className="flex flex-col gap-4">
      <Input
        type="email"
        placeholder="Digite seu email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        aria-label="Email address"
        required
      />
      <Button
        type="submit"
        className="hover:bg-opacity-90 bg-brand-blue text-white"
      >
        Cadastre para receber atualizações
      </Button>
      {message && <p className="text-green-500">{message}</p>}
    </form>
  );
}
