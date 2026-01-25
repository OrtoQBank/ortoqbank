'use client';

import { useMutation } from 'convex/react';
import { Check, ChevronRight, Edit, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useTenant } from '@/components/providers/TenantProvider';
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
import { useTenantQuery } from '@/hooks/useTenantQuery';

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

export default function GerenciarTemas() {
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
  const { tenantId } = useTenant();

  // Use tenant-aware query for hierarchical data
  const hierarchicalData = useTenantQuery(api.themes.getHierarchicalData, {});
  const createTheme = useMutation(api.themes.create);
  const createSubtheme = useMutation(api.subthemes.create);
  const createGroup = useMutation(api.groups.create);
  const updateTheme = useMutation(api.themes.update);
  const updateSubtheme = useMutation(api.subthemes.update);
  const updateGroup = useMutation(api.groups.update);
  const removeTheme = useMutation(api.themes.remove);
  const removeSubtheme = useMutation(api.subthemes.remove);
  const removeGroup = useMutation(api.groups.remove);

  if (!hierarchicalData) return <div>Carregando...</div>;

  const { themes, subthemes, groups } = hierarchicalData;

  const filteredSubthemes = selectedTheme
    ? subthemes.filter(subtheme => subtheme.themeId === selectedTheme)
    : [];

  const filteredGroups = selectedSubtheme
    ? groups.filter(group => group.subthemeId === selectedSubtheme)
    : [];

  const handleCreateTheme = async () => {
    if (!newTheme.trim() || !tenantId) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newThemePrefix
        ? normalizeText(newThemePrefix).toUpperCase()
        : '';

      await createTheme({
        tenantId,
        name: newTheme,
        prefix: sanitizedPrefix || generateDefaultPrefix(newTheme, 3),
      });
      clearNewTheme();
      toast({
        title: 'Tema criado',
        description: `Tema "${newTheme}" criado com sucesso.`,
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
    if (!newSubtheme.trim() || !selectedTheme || !tenantId) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newSubthemePrefix
        ? normalizeText(newSubthemePrefix).toUpperCase()
        : '';

      await createSubtheme({
        tenantId,
        name: newSubtheme,
        themeId: selectedTheme as Id<'themes'>,
        prefix: sanitizedPrefix || generateDefaultPrefix(newSubtheme, 2),
      });
      clearNewSubtheme();
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
    if (!newGroup.trim() || !selectedSubtheme || !tenantId) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = newGroupPrefix
        ? normalizeText(newGroupPrefix).toUpperCase()
        : '';

      await createGroup({
        tenantId,
        name: newGroup,
        subthemeId: selectedSubtheme as Id<'subthemes'>,
        prefix: sanitizedPrefix || generateDefaultPrefix(newGroup, 1),
      });
      clearNewGroup();
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
    if (!editThemeId || !editName.trim()) return;
    try {
      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = editPrefix
        ? normalizeText(editPrefix).toUpperCase()
        : '';

      await updateTheme({
        id: editThemeId as Id<'themes'>,
        name: editName,
        prefix: sanitizedPrefix || generateDefaultPrefix(editName, 3),
      });
      setEditThemeId(undefined);
      toast({
        title: 'Tema atualizado',
        description: `Tema "${editName}" atualizado com sucesso.`,
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
    if (!editSubthemeId || !editName.trim()) return;
    try {
      // Find the current subtheme to get its themeId
      const subtheme = subthemes.find(s => s._id === editSubthemeId);
      if (!subtheme) return;

      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = editPrefix
        ? normalizeText(editPrefix).toUpperCase()
        : '';

      await updateSubtheme({
        id: editSubthemeId as Id<'subthemes'>,
        name: editName,
        prefix: sanitizedPrefix || generateDefaultPrefix(editName, 2),
        themeId: subtheme.themeId as Id<'themes'>,
      });
      setEditSubthemeId(undefined);
      toast({
        title: 'Subtema atualizado',
        description: `Subtema "${editName}" atualizado com sucesso.`,
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
    if (!editGroupId || !editName.trim()) return;
    try {
      // Find the current group to get its subthemeId
      const group = groups.find(g => g._id === editGroupId);
      if (!group) return;

      // Ensure prefix is properly sanitized before saving
      const sanitizedPrefix = editPrefix
        ? normalizeText(editPrefix).toUpperCase()
        : '';

      await updateGroup({
        id: editGroupId as Id<'groups'>,
        name: editName,
        prefix: sanitizedPrefix || generateDefaultPrefix(editName, 1),
        subthemeId: group.subthemeId as Id<'subthemes'>,
      });
      setEditGroupId(undefined);
      toast({
        title: 'Subgrupo atualizado',
        description: `Subgrupo "${editName}" atualizado com sucesso.`,
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
      await removeTheme({ id: deleteThemeId as Id<'themes'> });
      setDeleteThemeId(undefined);
      setEditThemeId(undefined);

      // If the deleted theme is the selected one, clear the selection
      if (deleteThemeId === selectedTheme) {
        setSelectedTheme(undefined);
      }

      toast({
        title: 'Tema excluído',
        description: 'O tema foi excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete theme:', error);
      // Extract message from the error for better user experience
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast({
        title: 'Erro ao excluir tema',
        description: errorMessage,
        variant: 'destructive',
      });
      // Close the delete confirmation without closing the entire edit dialog
      setShowDeleteConfirmation(false);
    }
  };

  const handleConfirmDeleteSubtheme = async () => {
    if (!deleteSubthemeId) return;
    try {
      await removeSubtheme({ id: deleteSubthemeId as Id<'subthemes'> });
      setDeleteSubthemeId(undefined);
      setEditSubthemeId(undefined);

      // If the deleted subtheme is the selected one, clear the selection
      if (deleteSubthemeId === selectedSubtheme) {
        setSelectedSubtheme(undefined);
      }

      toast({
        title: 'Subtema excluído',
        description: 'O subtema foi excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete subtheme:', error);
      // Extract message from the error for better user experience
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast({
        title: 'Erro ao excluir subtema',
        description: errorMessage,
        variant: 'destructive',
      });
      // Close the delete confirmation without closing the entire edit dialog
      setShowDeleteConfirmation(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await removeGroup({ id: deleteGroupId as Id<'groups'> });
      setDeleteGroupId(undefined);
      setEditGroupId(undefined);

      // If the deleted group is the selected one, clear the selection
      if (deleteGroupId === selectedGroup) {
        setSelectedGroup(undefined);
      }

      toast({
        title: 'Subgrupo excluído',
        description: 'O subgrupo foi excluído com sucesso.',
      });
    } catch (error) {
      console.error('Failed to delete group:', error);
      // Extract message from the error for better user experience
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast({
        title: 'Erro ao excluir subgrupo',
        description: errorMessage,
        variant: 'destructive',
      });
      // Close the delete confirmation without closing the entire edit dialog
      setShowDeleteConfirmation(false);
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-6">
      <h1 className="text-xl font-bold sm:text-2xl">Gerenciar Temas</h1>

      {/* Selection Summary Section */}
      <div className="bg-muted/50 grid grid-cols-1 gap-4 rounded-lg p-3 sm:p-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tema Selecionado</h3>
          {selectedTheme ? (
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <div className="font-medium">
                  {themes.find(t => t._id === selectedTheme)?.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  Prefixo:{' '}
                  {themes.find(t => t._id === selectedTheme)?.prefix || '---'}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const theme = themes.find(t => t._id === selectedTheme);
                    if (theme) handleEditTheme(theme);
                  }}
                >
                  <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">
              Nenhum tema selecionado
            </div>
          )}
        </div>

        <Separator className="my-2" />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Subtema Selecionado</h3>
          {selectedSubtheme ? (
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <div className="font-medium">
                  {subthemes.find(s => s._id === selectedSubtheme)?.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  Prefixo:{' '}
                  {subthemes.find(s => s._id === selectedSubtheme)?.prefix ||
                    '---'}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const subtheme = subthemes.find(
                      s => s._id === selectedSubtheme,
                    );
                    if (subtheme) handleEditSubtheme(subtheme);
                  }}
                >
                  <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">
              Nenhum subtema selecionado
            </div>
          )}
        </div>

        <Separator className="my-2" />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Subgrupo Selecionado</h3>
          {selectedGroup ? (
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <div className="font-medium">
                  {groups.find(g => g._id === selectedGroup)?.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  Prefixo:{' '}
                  {groups.find(g => g._id === selectedGroup)?.prefix || '---'}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const group = groups.find(g => g._id === selectedGroup);
                    if (group) handleEditGroup(group);
                  }}
                >
                  <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">
              Nenhum subgrupo selecionado
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Themes Column */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold">Temas</h2>
            <Button size="sm" onClick={() => setShowCreateThemeModal(true)}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar Tema
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[250px] sm:h-[300px]">
                <div className="space-y-1 p-3 sm:p-4">
                  {themes.length === 0 ? (
                    <div className="text-muted-foreground py-6 text-center">
                      Nenhum tema criado
                    </div>
                  ) : (
                    themes.map(theme => (
                      <div
                        key={theme._id}
                        className={`flex cursor-pointer items-center justify-between rounded-md p-2 ${
                          selectedTheme === theme._id
                            ? 'bg-muted'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedTheme(theme._id)}
                      >
                        <div className="flex items-center gap-2">
                          {selectedTheme === theme._id && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                          <span className="max-w-[160px] truncate sm:max-w-none">
                            {theme.name}
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({theme.prefix || '---'})
                            </span>
                          </span>
                        </div>
                        {filteredSubthemes.length > 0 &&
                          selectedTheme === theme._id && (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Subthemes Column */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold">Subtemas</h2>
            {selectedTheme && (
              <Button
                size="sm"
                onClick={() => setShowCreateSubthemeModal(true)}
                disabled={!selectedTheme}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar Subtema
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[250px] sm:h-[300px]">
                <div className="space-y-1 p-3 sm:p-4">
                  {selectedTheme ? (
                    filteredSubthemes.length === 0 ? (
                      <div className="text-muted-foreground py-6 text-center">
                        Nenhum subtema criado para este tema
                      </div>
                    ) : (
                      filteredSubthemes.map(subtheme => (
                        <div
                          key={subtheme._id}
                          className={`flex cursor-pointer items-center justify-between rounded-md p-2 ${
                            selectedSubtheme === subtheme._id
                              ? 'bg-muted'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedSubtheme(subtheme._id)}
                        >
                          <div className="flex items-center gap-2">
                            {selectedSubtheme === subtheme._id && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            <span className="max-w-[160px] truncate sm:max-w-none">
                              {subtheme.name}
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({subtheme.prefix || '---'})
                              </span>
                            </span>
                          </div>
                          {filteredGroups.length > 0 &&
                            selectedSubtheme === subtheme._id && (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                        </div>
                      ))
                    )
                  ) : (
                    <div className="text-muted-foreground py-6 text-center">
                      Selecione um tema primeiro
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Groups Column */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold">Subgrupos</h2>
            {selectedSubtheme && (
              <Button
                size="sm"
                onClick={() => setShowCreateGroupModal(true)}
                disabled={!selectedSubtheme}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar Subgrupo
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[250px] sm:h-[300px]">
                <div className="space-y-1 p-3 sm:p-4">
                  {selectedSubtheme ? (
                    filteredGroups.length === 0 ? (
                      <div className="text-muted-foreground py-6 text-center">
                        Nenhum subgrupo criado para este subtema
                      </div>
                    ) : (
                      filteredGroups.map(group => (
                        <div
                          key={group._id}
                          className={`flex cursor-pointer items-center justify-between rounded-md p-2 ${
                            selectedGroup === group._id
                              ? 'bg-muted'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedGroup(group._id)}
                        >
                          <div className="flex items-center gap-2">
                            {selectedGroup === group._id && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            <span className="max-w-[160px] truncate sm:max-w-none">
                              {group.name}
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({group.prefix || '---'})
                              </span>
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <div className="text-muted-foreground py-6 text-center">
                      Selecione um subtema primeiro
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Theme Modal */}
      <Dialog
        open={showCreateThemeModal}
        onOpenChange={open => !open && setShowCreateThemeModal(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Tema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newTheme}
                onChange={e => setNewTheme(e.target.value)}
                placeholder="Nome do tema"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefixo (3 letras)</label>
              <Input
                value={newThemePrefix}
                onChange={e => handlePrefixChange(e, setNewThemePrefix)}
                maxLength={3}
                placeholder="Prefixo (opcional)"
              />
              <p className="text-muted-foreground text-xs">
                O prefixo será gerado automaticamente se não for fornecido
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
            <Button
              onClick={() => {
                handleCreateTheme();
                setShowCreateThemeModal(false);
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subtheme Modal */}
      <Dialog
        open={showCreateSubthemeModal}
        onOpenChange={open => !open && setShowCreateSubthemeModal(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Subtema</DialogTitle>
            <DialogDescription>
              Tema: {themes.find(t => t._id === selectedTheme)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newSubtheme}
                onChange={e => setNewSubtheme(e.target.value)}
                placeholder="Nome do subtema"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefixo (2 letras)</label>
              <Input
                value={newSubthemePrefix}
                onChange={e => handlePrefixChange(e, setNewSubthemePrefix)}
                maxLength={2}
                placeholder="Prefixo (opcional)"
              />
              <p className="text-muted-foreground text-xs">
                O prefixo será gerado automaticamente se não for fornecido
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
            <Button
              onClick={() => {
                handleCreateSubtheme();
                setShowCreateSubthemeModal(false);
              }}
              disabled={!selectedTheme}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Modal */}
      <Dialog
        open={showCreateGroupModal}
        onOpenChange={open => !open && setShowCreateGroupModal(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Subgrupo</DialogTitle>
            <DialogDescription>
              Subtema: {subthemes.find(s => s._id === selectedSubtheme)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                placeholder="Nome do subgrupo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefixo (1 letra)</label>
              <Input
                value={newGroupPrefix}
                onChange={e => handlePrefixChange(e, setNewGroupPrefix)}
                maxLength={1}
                placeholder="Prefixo (opcional)"
              />
              <p className="text-muted-foreground text-xs">
                O prefixo será gerado automaticamente se não for fornecido
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
            <Button
              onClick={() => {
                handleCreateGroup();
                setShowCreateGroupModal(false);
              }}
              disabled={!selectedSubtheme}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Theme Dialog */}
      <Dialog
        open={!!editThemeId}
        onOpenChange={open => {
          if (!open) {
            setEditThemeId(undefined);
            setShowDeleteConfirmation(false);
          }
        }}
      >
        <DialogContent>
          {showDeleteConfirmation ? (
            <>
              <DialogHeader>
                <DialogTitle>Excluir Tema</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir este tema? Esta ação é
                  irreversível.
                  <br />
                  <strong>Nota:</strong> Não é possível excluir um tema que
                  possui subtemas, está sendo usado por questões ou por quizzes
                  pré-definidos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmation(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleConfirmDeleteTheme();
                    setShowDeleteConfirmation(false);
                  }}
                >
                  Excluir
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Editar Tema</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Prefixo (3 letras)
                  </label>
                  <Input
                    value={editPrefix}
                    onChange={e => handlePrefixChange(e, setEditPrefix)}
                    maxLength={3}
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col justify-between gap-2 sm:flex-row">
                <div className="flex justify-start">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteThemeId(editThemeId);
                      setShowDeleteConfirmation(true);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir Tema
                  </Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditThemeId(undefined)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTheme}>Salvar</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Subtheme Dialog */}
      <Dialog
        open={!!editSubthemeId}
        onOpenChange={open => {
          if (!open) {
            setEditSubthemeId(undefined);
            setShowDeleteConfirmation(false);
          }
        }}
      >
        <DialogContent>
          {showDeleteConfirmation ? (
            <>
              <DialogHeader>
                <DialogTitle>Excluir Subtema</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir este subtema? Esta ação é
                  irreversível.
                  <br />
                  <strong>Nota:</strong> Não é possível excluir um subtema que
                  possui grupos, está sendo usado por questões ou por quizzes
                  pré-definidos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmation(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleConfirmDeleteSubtheme();
                    setShowDeleteConfirmation(false);
                  }}
                >
                  Excluir
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Editar Subtema</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Prefixo (2 letras)
                  </label>
                  <Input
                    value={editPrefix}
                    onChange={e => handlePrefixChange(e, setEditPrefix)}
                    maxLength={2}
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col justify-between gap-2 sm:flex-row">
                <div className="flex justify-start">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteSubthemeId(editSubthemeId);
                      setShowDeleteConfirmation(true);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir Subtema
                  </Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditSubthemeId(undefined)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveSubtheme}>Salvar</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog
        open={!!editGroupId}
        onOpenChange={open => {
          if (!open) {
            setEditGroupId(undefined);
            setShowDeleteConfirmation(false);
          }
        }}
      >
        <DialogContent>
          {showDeleteConfirmation ? (
            <>
              <DialogHeader>
                <DialogTitle>Excluir Subgrupo</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir este subgrupo? Esta ação é
                  irreversível.
                  <br />
                  <strong>Nota:</strong> Não é possível excluir um subgrupo que
                  está sendo usado por questões ou por quizzes pré-definidos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmation(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleConfirmDeleteGroup();
                    setShowDeleteConfirmation(false);
                  }}
                >
                  Excluir
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Editar Subgrupo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Prefixo (1 letra)
                  </label>
                  <Input
                    value={editPrefix}
                    onChange={e => handlePrefixChange(e, setEditPrefix)}
                    maxLength={1}
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col justify-between gap-2 sm:flex-row">
                <div className="flex justify-start">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteGroupId(editGroupId);
                      setShowDeleteConfirmation(true);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir Subgrupo
                  </Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditGroupId(undefined)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveGroup}>Salvar</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
