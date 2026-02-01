'use client';

import { useMutation,useQuery } from 'convex/react';
import { Edit, Loader2, Search, Shield } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSession } from '@/components/providers/SessionProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

type UserToEdit = {
  _id: Id<'users'>;
  firstName?: string;
  lastName?: string;
  email: string;
  imageUrl?: string;
};

export default function SuperAdminPage() {
  const router = useRouter();
  const { isAdmin, isLoading: sessionLoading } = useSession();

  // Redirect non-super-admins
  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      router.push('/admin');
    }
  }, [sessionLoading, isAdmin, router]);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserToEdit | null>(null);
  const [loadingApps, setLoadingApps] = useState<Set<Id<'apps'>>>(new Set());

  // Queries
  const allApps = useQuery(api.apps.listAllApps);
  const allUsers = useQuery(api.users.getAllUsersForAdmin, { limit: 200 });
  const searchResults = useQuery(
    api.users.searchUsersForAdmin,
    searchQuery.length >= 2 ? { searchQuery, limit: 100 } : 'skip',
  );

  // Query for the user being edited - their app access
  const userAppAccess = useQuery(
    api.userAppAccess.getUserApps,
    editingUser ? { userId: editingUser._id } : 'skip',
  );

  // Mutations
  const grantAccess = useMutation(api.userAppAccess.grantAccess);
  const revokeAccess = useMutation(api.userAppAccess.revokeAccess);

  // Use search results if searching, otherwise use all users
  const displayUsers = searchQuery.length >= 2 ? searchResults : allUsers;

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleToggleAppAccess = async (appId: Id<'apps'>, hasAccess: boolean) => {
    if (!editingUser) return;

    setLoadingApps(prev => new Set(prev).add(appId));
    try {
      await (hasAccess ? revokeAccess({ userId: editingUser._id, appId }) : grantAccess({ userId: editingUser._id, appId, role: 'user' }));
    } catch (error) {
      console.error('Error toggling access:', error);
    } finally {
      setLoadingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appId);
        return newSet;
      });
    }
  };

  const handleChangeRole = async (appId: Id<'apps'>, role: 'user' | 'moderator') => {
    if (!editingUser) return;

    setLoadingApps(prev => new Set(prev).add(appId));
    try {
      // Grant access with new role (this will update existing record)
      await grantAccess({ userId: editingUser._id, appId, role });
    } catch (error) {
      console.error('Error changing role:', error);
    } finally {
      setLoadingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appId);
        return newSet;
      });
    }
  };

  // Show loading while checking permissions
  if (sessionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  // Build a map of app access for the user being edited
  const userAccessMap = new Map<
    Id<'apps'>,
    { hasAccess: boolean; role?: 'user' | 'moderator' }
  >();
  if (userAppAccess) {
    for (const access of userAppAccess) {
      userAccessMap.set(access.appId, {
        hasAccess: access.hasAccess,
        role: access.role,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            <CardTitle>Super Admin - Gerenciamento Global</CardTitle>
          </div>
          <CardDescription>
            Gerencie permissões de usuários através de todos os apps
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome ou email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch} size="default">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários do Sistema</CardTitle>
          <CardDescription>
            {displayUsers === undefined
              ? 'Carregando...'
              : `${displayUsers.length} usuário${displayUsers.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayUsers === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : displayUsers.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="w-24">Role Global</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers.map(user => (
                  <TableRow key={user._id}>
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
                      <span className="text-muted-foreground text-sm">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className={user.role === 'admin' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditingUser({
                            _id: user._id,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                            imageUrl: user.imageUrl,
                          })
                        }
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Apps Dialog */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Acessos</DialogTitle>
            <DialogDescription>
              {editingUser && (
                <span className="flex items-center gap-2 pt-2">
                  {editingUser.imageUrl ? (
                    <Image
                      src={editingUser.imageUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-xs">
                      {(editingUser.firstName?.[0] ?? editingUser.email[0]).toUpperCase()}
                    </div>
                  )}
                  <span>
                    {editingUser.firstName} {editingUser.lastName} ({editingUser.email})
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-4">
            {allApps === undefined ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              allApps.map(app => {
                const access = userAccessMap.get(app._id);
                const hasAccess = access?.hasAccess ?? false;
                const role = access?.role ?? 'user';
                const isLoading = loadingApps.has(app._id);

                return (
                  <div
                    key={app._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`app-${app._id}`}
                        checked={hasAccess}
                        disabled={isLoading}
                        onCheckedChange={() => handleToggleAppAccess(app._id, hasAccess)}
                      />
                      <div>
                        <Label
                          htmlFor={`app-${app._id}`}
                          className="cursor-pointer font-medium"
                        >
                          {app.name}
                        </Label>
                        <p className="text-muted-foreground text-xs">{app.domain}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : hasAccess ? (
                        <Select
                          value={role}
                          onValueChange={(value: 'user' | 'moderator') =>
                            handleChangeRole(app._id, value)
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário</SelectItem>
                            <SelectItem value="moderator">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem acesso</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
