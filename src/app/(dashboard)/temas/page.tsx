'use client';

import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
interface Theme {
  _id: Id<'themes'>;
  _creationTime: number;
  name: string;
}

export default function ThemesPage() {
  const themes: Theme[] | undefined = useQuery(api.themes.list);

  if (!themes) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Temas</h1>
      <div className="space-y-2">
        {themes?.map((theme: Theme) => <div key={theme._id}>{theme.name}</div>)}
      </div>
    </div>
  );
}
