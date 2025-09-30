'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function SearchUsersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Update local state when URL parameters change
  useEffect(() => {
    setSearchTerm(currentSearch);
  }, [currentSearch]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(
        `${pathname}?search=${encodeURIComponent(searchTerm.trim())}`,
      );
    } else {
      // If search is empty, just go to the base page without parameters
      router.push(pathname);
    }
  };

  const resetSearch = () => {
    setSearchTerm('');
    router.push(pathname);
  };

  return (
    <div className="w-full space-y-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
            <Search size={18} />
          </div>
          <input
            id="search"
            name="search"
            type="text"
            placeholder="Pesquisar usuários por nome ou email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border py-2 pr-4 pl-10 shadow-sm focus-visible:ring-1 focus-visible:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              aria-label="Limpar pesquisa"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring rounded-md px-4 py-2 shadow focus-visible:ring-1 focus-visible:outline-none"
        >
          Pesquisar
        </button>
      </form>
    </div>
  );
}

export const SearchUsers = () => {
  return (
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchUsersContent />
    </Suspense>
  );
};
