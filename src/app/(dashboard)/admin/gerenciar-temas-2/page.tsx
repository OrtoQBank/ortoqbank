'use client';

import { useMutation, useQuery } from 'convex/react';
import { Check, ChevronRight, Edit, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
// Import utility functions from Convex
// Note: This is a client import of a server module, but we're only using pure functions
// that work in both environments
import {
  generateDefaultPrefix,
  normalizeText,
} from '../../../../../convex/utils';
import { useThemeStore } from './store';

// Helper function for handling prefix input changes
const handlePrefixChange = (
  event: React.ChangeEvent<HTMLInputElement>,
  setter: (value: string) => void,
) => {
  // Get clean, normalized value with all special characters removed
  const sanitizedValue = normalizeText(event.target.value).toUpperCase();
  setter(sanitizedValue);
};

export default function GerenciarTemas2() {
  const {
    // Selection state
    selectedTheme,
    selectedSubtheme,
    selectedGroup,
    setSelectedTheme,
    setSelectedSubtheme,
    setSelectedGroup,
    // Form state
    newTheme,
    newSubtheme,
    newGroup,
    newThemePrefix,
    newSubthemePrefix,
    newGroupPrefix,
    setNewTheme,
    setNewSubtheme,
    setNewGroup,
    setNewThemePrefix,
    setNewSubthemePrefix,
    setNewGroupPrefix,
    clearNewTheme,
    clearNewSubtheme,
    clearNewGroup,
  } = useThemeStore();

  // Edit state
  const [editThemeId, setEditThemeId] = useState<string | undefined>();
  const [editSubthemeId, setEditSubthemeId] = useState<string | undefined>();
  const [editGroupId, setEditGroupId] = useState<string | undefined>();
  const [editName, setEditName] = useState('');
  const [editPrefix, setEditPrefix] = useState('');

  // Delete confirmation state
  const [deleteThemeId, setDeleteThemeId] = useState<string | undefined>();
  const [deleteSubthemeId, setDeleteSubthemeId] = useState<
    string | undefined
  >();
  const [deleteGroupId, setDeleteGroupId] = useState<string | undefined>();

  // Create modal state
  const [showCreateThemeModal, setShowCreateThemeModal] = useState(false);
  const [showCreateSubthemeModal, setShowCreateSubthemeModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Delete confirmation state within edit modals
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const { toast } = useToast();

  // Updated to use new taxonomy APIs
  const hierarchicalData = useQuery(api.themesNew.getHierarchicalData);
  const createTheme = useMutation(api.themesNew.create);
  const createSubtheme = useMutation(api.subthemesNew.create);
  const createGroup = useMutation(api.groupsNew.create);
  const updateTheme = useMutation(api.themesNew.update);
  const updateSubtheme = useMutation(api.subthemesNew.update);
  const updateGroup = useMutation(api.groupsNew.update);
  const removeTheme = useMutation(api.themesNew.remove);
  const removeSubtheme = useMutation(api.subthemesNew.remove);
  const removeGroup = useMutation(api.groupsNew.remove);

  if (!hierarchicalData) return <div>Carregando...</div>;

  const { themes, subthemes, groups } = hierarchicalData;

  const filteredSubthemes = selectedTheme
    ? subthemes.filter(subtheme => subtheme.themeId === selectedTheme)
    : [];

  const filteredGroups = selectedSubtheme
    ? groups.filter(group => group.subthemeId === selectedSubtheme)
    : [];

  const handleCreateTheme = async () => {
    if (!newTheme.trim()) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newThemePrefix
        ? normalizeText(newThemePrefix).toUpperCase()
        : '';

      await createTheme({
        name: newTheme,
        prefix: sanitizedPrefix || generateDefaultPrefix(newTheme, 3),
      });
      clearNewTheme();
      setShowCreateThemeModal(false);
      toast({
        title: 'Tema criado',
        description: `Tema "${newTheme}" criado com sucesso no novo sistema.`,
      });
    } catch (error) {
      console.error('Failed to create theme:', error);
      toast({
        title: 'Erro ao criar tema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleCreateSubtheme = async () => {
    if (!newSubtheme.trim() || !selectedTheme) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newSubthemePrefix
        ? normalizeText(newSubthemePrefix).toUpperCase()
        : '';

      await createSubtheme({
        name: newSubtheme,
        themeId: selectedTheme as Id<'taxonomy'>,
        prefix: sanitizedPrefix || generateDefaultPrefix(newSubtheme, 2),
      });
      clearNewSubtheme();
      setShowCreateSubthemeModal(false);
      toast({
        title: 'Subtema criado',
        description: `Subtema "${newSubtheme}" criado com sucesso.`,
      });
    } catch (error) {
      console.error('Failed to create subtheme:', error);
      toast({
        title: 'Erro ao criar subtema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.trim() || !selectedSubtheme) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newGroupPrefix
        ? normalizeText(newGroupPrefix).toUpperCase()
        : '';

      await createGroup({
        name: newGroup,
        subthemeId: selectedSubtheme as Id<'taxonomy'>,
        prefix: sanitizedPrefix || generateDefaultPrefix(newGroup, 1),
      });
      clearNewGroup();
      setShowCreateGroupModal(false);
      toast({
        title: 'Subgrupo criado',
        description: `Subgrupo "${newGroup}" criado com sucesso.`,
      });
    } catch (error) {
      console.error('Failed to create group:', error);
      toast({
        title: 'Erro ao criar subgrupo',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleEditTheme = (theme: any) => {
    setEditThemeId(theme._id);
    setEditName(theme.name);
    setEditPrefix(theme.prefix || '');
  };

  const handleEditSubtheme = (subtheme: any) => {
    setEditSubthemeId(subtheme._id);
    setEditName(subtheme.name);
    setEditPrefix(subtheme.prefix || '');
  };

  const handleEditGroup = (group: any) => {
    setEditGroupId(group._id);
    setEditName(group.name);
    setEditPrefix(group.prefix || '');
  };

  const handleDeleteTheme = (themeId: string) => {
    setDeleteThemeId(themeId);
  };

  const handleDeleteSubtheme = (subthemeId: string) => {
    setDeleteSubthemeId(subthemeId);
  };

  const handleDeleteGroup = (groupId: string) => {
    setDeleteGroupId(groupId);
  };

  const handleSaveTheme = async () => {
    if (!editThemeId) return;
    try {
      await updateTheme({
        id: editThemeId as Id<'taxonomy'>,
        name: editName,
        prefix: editPrefix || undefined,
      });
      setEditThemeId(undefined);
      setEditName('');
      setEditPrefix('');
      toast({
        title: 'Tema atualizado',
        description: 'Tema atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Failed to update theme:', error);
      toast({
        title: 'Erro ao atualizar tema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleSaveSubtheme = async () => {
    if (!editSubthemeId) return;
    try {
      await updateSubtheme({
        id: editSubthemeId as Id<'taxonomy'>,
        name: editName,
        prefix: editPrefix || undefined,
      });
      setEditSubthemeId(undefined);
      setEditName('');
      setEditPrefix('');
      toast({
        title: 'Subtema atualizado',
        description: 'Subtema atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Failed to update subtheme:', error);
      toast({
        title: 'Erro ao atualizar subtema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleSaveGroup = async () => {
    if (!editGroupId) return;
    try {
      await updateGroup({
        id: editGroupId as Id<'taxonomy'>,
        name: editName,
        prefix: editPrefix || undefined,
      });
      setEditGroupId(undefined);
      setEditName('');
      setEditPrefix('');
      toast({
        title: 'Subgrupo atualizado',
        description: 'Subgrupo atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Failed to update group:', error);
      toast({
        title: 'Erro ao atualizar subgrupo',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDeleteTheme = async () => {
    if (!deleteThemeId) return;
    try {
      await removeTheme({ id: deleteThemeId as Id<'taxonomy'> });
      setDeleteThemeId(undefined);
      // Clear selection if deleting selected theme
      if (selectedTheme === deleteThemeId) {
        setSelectedTheme(undefined);
        setSelectedSubtheme(undefined);
        setSelectedGroup(undefined);
      }
      toast({
        title: 'Tema excluído',
        description: 'Tema excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete theme:', error);
      toast({
        title: 'Erro ao excluir tema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDeleteSubtheme = async () => {
    if (!deleteSubthemeId) return;
    try {
      await removeSubtheme({ id: deleteSubthemeId as Id<'taxonomy'> });
      setDeleteSubthemeId(undefined);
      // Clear selection if deleting selected subtheme
      if (selectedSubtheme === deleteSubthemeId) {
        setSelectedSubtheme(undefined);
        setSelectedGroup(undefined);
      }
      toast({
        title: 'Subtema excluído',
        description: 'Subtema excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete subtheme:', error);
      toast({
        title: 'Erro ao excluir subtema',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await removeGroup({ id: deleteGroupId as Id<'taxonomy'> });
      setDeleteGroupId(undefined);
      // Clear selection if deleting selected group
      if (selectedGroup === deleteGroupId) {
        setSelectedGroup(undefined);
      }
      toast({
        title: 'Subgrupo excluído',
        description: 'Subgrupo excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast({
        title: 'Erro ao excluir subgrupo',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          Gerenciar Temas - Sistema Novo 🚀
        </h1>
        <p className="text-muted-foreground mt-2">
          Versão de teste usando o novo sistema de taxonomia. Todos os dados são
          salvos no novo formato.
        </p>
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            ℹ️ Esta página usa as novas APIs do sistema de taxonomia. Os dados
            criados aqui serão compatíveis com o novo sistema.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Themes Panel */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Temas</h2>
                <Button size="sm" onClick={() => setShowCreateThemeModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Tema
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="p-2">
                {themes.map(theme => (
                  <div
                    key={theme._id}
                    className={`mb-2 cursor-pointer rounded-md border p-3 ${
                      selectedTheme === theme._id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted border-transparent'
                    }`}
                    onClick={() => {
                      setSelectedTheme(theme._id);
                      setSelectedSubtheme(undefined);
                      setSelectedGroup(undefined);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{theme.name}</span>
                        {theme.prefix && (
                          <span className="bg-muted rounded px-2 py-1 text-xs">
                            {theme.prefix}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleEditTheme(theme);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteTheme(theme._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {selectedTheme === theme._id && (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Subthemes Panel */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Subtemas</h2>
                <Button
                  size="sm"
                  disabled={!selectedTheme}
                  onClick={() => setShowCreateSubthemeModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Subtema
                </Button>
              </div>
              {!selectedTheme && (
                <p className="text-muted-foreground mt-2 text-sm">
                  Selecione um tema para ver os subtemas
                </p>
              )}
            </div>
            <ScrollArea className="h-[600px]">
              <div className="p-2">
                {filteredSubthemes.map(subtheme => (
                  <div
                    key={subtheme._id}
                    className={`mb-2 cursor-pointer rounded-md border p-3 ${
                      selectedSubtheme === subtheme._id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted border-transparent'
                    }`}
                    onClick={() => {
                      setSelectedSubtheme(subtheme._id);
                      setSelectedGroup(undefined);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{subtheme.name}</span>
                        {subtheme.prefix && (
                          <span className="bg-muted rounded px-2 py-1 text-xs">
                            {subtheme.prefix}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleEditSubtheme(subtheme);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteSubtheme(subtheme._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {selectedSubtheme === subtheme._id && (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Groups Panel */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Subgrupos</h2>
                <Button
                  size="sm"
                  disabled={!selectedSubtheme}
                  onClick={() => setShowCreateGroupModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Subgrupo
                </Button>
              </div>
              {!selectedSubtheme && (
                <p className="text-muted-foreground mt-2 text-sm">
                  Selecione um subtema para ver os subgrupos
                </p>
              )}
            </div>
            <ScrollArea className="h-[600px]">
              <div className="p-2">
                {filteredGroups.map(group => (
                  <div
                    key={group._id}
                    className={`mb-2 cursor-pointer rounded-md border p-3 ${
                      selectedGroup === group._id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted border-transparent'
                    }`}
                    onClick={() => setSelectedGroup(group._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{group.name}</span>
                        {group.prefix && (
                          <span className="bg-muted rounded px-2 py-1 text-xs">
                            {group.prefix}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleEditGroup(group);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteGroup(group._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Create Theme Modal */}
      <Dialog
        open={showCreateThemeModal}
        onOpenChange={setShowCreateThemeModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Tema</DialogTitle>
            <DialogDescription>
              Adicione um novo tema ao sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Tema</label>
              <Input
                value={newTheme}
                onChange={e => setNewTheme(e.target.value)}
                placeholder="Ex: Anatomia"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo (opcional)</label>
              <Input
                value={newThemePrefix}
                onChange={e => handlePrefixChange(e, setNewThemePrefix)}
                placeholder="Ex: ANA"
                maxLength={5}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Se não informado, será gerado automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateThemeModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateTheme}>Criar Tema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subtheme Modal */}
      <Dialog
        open={showCreateSubthemeModal}
        onOpenChange={setShowCreateSubthemeModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Subtema</DialogTitle>
            <DialogDescription>
              Adicione um novo subtema ao tema selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Subtema</label>
              <Input
                value={newSubtheme}
                onChange={e => setNewSubtheme(e.target.value)}
                placeholder="Ex: Sistema Cardiovascular"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo (opcional)</label>
              <Input
                value={newSubthemePrefix}
                onChange={e => handlePrefixChange(e, setNewSubthemePrefix)}
                placeholder="Ex: CV"
                maxLength={5}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Se não informado, será gerado automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateSubthemeModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateSubtheme}>Criar Subtema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Modal */}
      <Dialog
        open={showCreateGroupModal}
        onOpenChange={setShowCreateGroupModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Subgrupo</DialogTitle>
            <DialogDescription>
              Adicione um novo subgrupo ao subtema selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Subgrupo</label>
              <Input
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                placeholder="Ex: Válvulas Cardíacas"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo (opcional)</label>
              <Input
                value={newGroupPrefix}
                onChange={e => handlePrefixChange(e, setNewGroupPrefix)}
                placeholder="Ex: V"
                maxLength={5}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Se não informado, será gerado automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateGroupModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateGroup}>Criar Subgrupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Theme Modal */}
      <Dialog
        open={!!editThemeId}
        onOpenChange={() => setEditThemeId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Tema</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo</label>
              <Input
                value={editPrefix}
                onChange={e => handlePrefixChange(e, setEditPrefix)}
                maxLength={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditThemeId(undefined)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTheme}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subtheme Modal */}
      <Dialog
        open={!!editSubthemeId}
        onOpenChange={() => setEditSubthemeId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Subtema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Subtema</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo</label>
              <Input
                value={editPrefix}
                onChange={e => handlePrefixChange(e, setEditPrefix)}
                maxLength={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSubthemeId(undefined)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveSubtheme}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog
        open={!!editGroupId}
        onOpenChange={() => setEditGroupId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Subgrupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Subgrupo</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Prefixo</label>
              <Input
                value={editPrefix}
                onChange={e => handlePrefixChange(e, setEditPrefix)}
                maxLength={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupId(undefined)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGroup}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Theme Confirmation */}
      <Dialog
        open={!!deleteThemeId}
        onOpenChange={() => setDeleteThemeId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir este tema? Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteThemeId(undefined)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteTheme}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subtheme Confirmation */}
      <Dialog
        open={!!deleteSubthemeId}
        onOpenChange={() => setDeleteSubthemeId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir este subtema? Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSubthemeId(undefined)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteSubtheme}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <Dialog
        open={!!deleteGroupId}
        onOpenChange={() => setDeleteGroupId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir este subgrupo? Esta ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteGroupId(undefined)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteGroup}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
