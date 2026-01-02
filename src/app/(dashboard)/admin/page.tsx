'use client';

import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import { useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { Doc, Id } from '../../../../convex/_generated/dataModel';
import { SearchUsers } from './search-users';

export default function AdminDashboard() {
  // Role check moved to layout

  // Convex mutations for role management
  const setUserRole = useMutation(api.users.setUserRole);

  // State for loading states
  const [loadingUsers, setLoadingUsers] = useState<Set<Id<'users'>>>(new Set());

  // Fetch users from backend database instead of Clerk
  const usersFromAll = useQuery(
    api.users.getAllUsersForAdmin,
    { limit: 20 },
  );

  const users = usersFromAll;

  const handleSetRole = async (userId: Id<'users'>, role: string) => {
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

  const handleRemoveRole = async (userId: Id<'users'>) => {
    setLoadingUsers(prev => new Set(prev).add(userId));
    try {
      await setUserRole({ userId, role: undefined });
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

  if (!users) {
    return <div>Loading...</div>;
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-4 text-xl font-semibold">Permissões de Usuários</h2>
      <SearchUsers />

      <div className="mt-4 px-1">
        <p className="text-muted-foreground text-sm">
          Mostrando todos os {users?.length || 0} usuário
          {users?.length === 1 ? '' : 's'}
        </p>
      </div>

      {users && users.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user: Doc<'users'>) => {
            // User data now comes from backend database
            const email = user.email;
            const role = user.role;

            return (
              <div
                key={user.clerkUserId}
                className="rounded-lg border p-4 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  {user.imageUrl && (
                    <Image
                      src={user.imageUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-medium">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="text-muted-foreground text-wrap">{email}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-muted-foreground text-sm font-medium">
                    Cargo Atual:
                  </span>
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      role === 'admin'
                        ? 'bg-brand-blue/10 text-brand-blue/90 dark:bg-brand-blue/30 dark:text-brand-blue/40'
                        : role === 'moderator'
                          ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400'
                    }`}
                  >
                    {role || 'Usuário'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSetRole(user._id, 'admin')}
                    className="inline-flex h-8 items-center rounded-md border border-transparent bg-brand-blue px-3 text-xs font-medium text-white hover:bg-brand-blue/90 focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                    disabled={role === 'admin' || loadingUsers.has(user._id)}
                  >
                    {loadingUsers.has(user._id)
                      ? 'Carregando...'
                      : 'Tornar Admin'}
                  </button>

                  <button
                    onClick={() => handleSetRole(user._id, 'moderator')}
                    className="hover:bg-muted inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                    disabled={
                      role === 'moderator' || loadingUsers.has(user._id)
                    }
                  >
                    {loadingUsers.has(user._id)
                      ? 'Carregando...'
                      : 'Tornar Moderador'}
                  </button>

                  <button
                    onClick={() => handleRemoveRole(user._id)}
                    className="inline-flex h-8 items-center rounded-md border border-red-200 px-3 text-xs font-medium text-red-900 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:border-red-900/30 dark:text-red-600 dark:hover:bg-red-900/20"
                    disabled={!role || loadingUsers.has(user._id)}
                  >
                    {loadingUsers.has(user._id)
                      ? 'Carregando...'
                      : 'Remover Cargo'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

