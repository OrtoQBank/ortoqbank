'use client';

import { ChevronDown, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useTenantMutation,
  useTenantPaginatedQuery,
  useTenantQuery,
} from '@/hooks/useTenantQuery';

import { SearchUsers } from './search-users';

const ITEMS_PER_PAGE = 20;

export default function AdminDashboard() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  // Convex mutations for role management (tenant-scoped)
  const setUserRole = useTenantMutation(api.userAppAccess.setUserRoleForApp);

  // State for loading states
  const [loadingUsers, setLoadingUsers] = useState<Set<Id<'users'>>>(new Set());

  // Paginated query for listing users (no search)
  const {
    results: paginatedUsers,
    status,
    loadMore,
    isLoading: isPaginatedLoading,
  } = useTenantPaginatedQuery(
    api.userAppAccess.getAppUsersForAdmin,
    {},
    { initialNumItems: ITEMS_PER_PAGE },
  );

  // Search query (not paginated, but limited)
  const searchResults = useTenantQuery(
    api.userAppAccess.searchAppUsersForAdmin,
    searchQuery ? { searchQuery, limit: 100 } : 'skip',
  );

  // Use search results if searching, otherwise use paginated results
  const isSearching = !!searchQuery;
  const displayUsers = isSearching ? searchResults : paginatedUsers;
  const isLoading = isSearching ? !searchResults : isPaginatedLoading;

  // Filter to only show users with active access
  const activeUsers = (displayUsers ?? []).filter(
    access => access.hasAccess && !access.isExpired && access.user,
  );

  const handleSetRole = async (
    userId: Id<'users'>,
    role: 'user' | 'moderator',
  ) => {
    setLoadingUsers(prev => new Set(prev).add(userId));
    try {
      await setUserRole({ userId, role });
    } catch (error) {
      console.error('Error setting role:', error);
    } finally {
      setLoadingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleDemoteToUser = async (userId: Id<'users'>) => {
    setLoadingUsers(prev => new Set(prev).add(userId));
    try {
      await setUserRole({ userId, role: 'user' });
    } catch (error) {
      console.error('Error removing role:', error);
    } finally {
      setLoadingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-4 text-xl font-semibold">Permissões de Usuários</h2>
      <SearchUsers />

      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-muted-foreground text-sm">
          {isSearching
            ? `${activeUsers.length} resultado${activeUsers.length === 1 ? '' : 's'} encontrado${activeUsers.length === 1 ? '' : 's'}`
            : `Mostrando ${activeUsers.length} usuário${activeUsers.length === 1 ? '' : 's'} com acesso`}
        </p>
        {!isSearching && status === 'CanLoadMore' && (
          <span className="text-muted-foreground text-xs">
            Role para baixo ou clique em &quot;Carregar mais&quot;
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando...</span>
        </div>
      ) : activeUsers.length > 0 ? (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="w-28">Cargo</TableHead>
                <TableHead className="w-48 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map(access => {
                const user = access.user;
                if (!user) return null;

                const role = access.role;
                const isUserLoading = loadingUsers.has(user._id);

                return (
                  <TableRow key={access._id}>
                    <TableCell>
                      {user.imageUrl ? (
                        <Image
                          src={user.imageUrl}
                          alt={`${user.firstName ?? ''} ${user.lastName ?? ''}`}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                          {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-muted-foreground text-xs md:hidden">
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-muted-foreground text-sm">
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={role === 'moderator' ? 'default' : 'secondary'}
                        className={
                          role === 'moderator'
                            ? 'bg-green-600 hover:bg-green-700'
                            : ''
                        }
                      >
                        {role === 'moderator' ? 'Editor' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="duolingo"
                          onClick={() => handleSetRole(user._id, 'moderator')}
                          disabled={role === 'moderator' || isUserLoading}
                          className="h-7 px-2 text-xs"
                        >
                          {isUserLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Editor'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDemoteToUser(user._id)}
                          disabled={role !== 'moderator' || isUserLoading}
                          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {isUserLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Rebaixar'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination controls */}
          {!isSearching && status === 'CanLoadMore' && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadMore(ITEMS_PER_PAGE)}
                disabled={status === 'LoadingMore'}
                className="gap-2"
              >
                {status === 'LoadingMore' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Carregar mais
                  </>
                )}
              </Button>
            </div>
          )}

          {!isSearching && status === 'Exhausted' && activeUsers.length > 0 && (
            <p className="text-muted-foreground mt-4 text-center text-sm">
              Todos os usuários foram carregados
            </p>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground mt-6 text-center">
          {isSearching
            ? 'Nenhum usuário encontrado com esse termo de busca.'
            : 'Nenhum usuário com acesso a este app.'}
        </div>
      )}
    </div>
  );
}
