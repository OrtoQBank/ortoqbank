import { create } from 'zustand';

interface ThemeState {
  // Selection state
  selectedTheme: string | undefined;
  selectedSubtheme: string | undefined;
  selectedGroup: string | undefined;

  // Form state
  newTheme: string;
  newSubtheme: string;
  newGroup: string;
  newThemePrefix: string;
  newSubthemePrefix: string;
  newGroupPrefix: string;

  // Selection actions
  setSelectedTheme: (themeId: string | undefined) => void;
  setSelectedSubtheme: (subthemeId: string | undefined) => void;
  setSelectedGroup: (groupId: string | undefined) => void;

  // Form actions
  setNewTheme: (name: string) => void;
  setNewSubtheme: (name: string) => void;
  setNewGroup: (name: string) => void;
  setNewThemePrefix: (prefix: string) => void;
  setNewSubthemePrefix: (prefix: string) => void;
  setNewGroupPrefix: (prefix: string) => void;
  clearNewTheme: () => void;
  clearNewSubtheme: () => void;
  clearNewGroup: () => void;

  reset: () => void;
}

export const useThemeStore = create<ThemeState>(set => ({
  // Selection state
  selectedTheme: undefined,
  selectedSubtheme: undefined,
  selectedGroup: undefined,

  // Form state
  newTheme: '',
  newSubtheme: '',
  newGroup: '',
  newThemePrefix: '',
  newSubthemePrefix: '',
  newGroupPrefix: '',

  // Selection actions
  setSelectedTheme: themeId =>
    set({
      selectedTheme: themeId,
      selectedSubtheme: undefined,
      selectedGroup: undefined,
    }),

  setSelectedSubtheme: subthemeId =>
    set({
      selectedSubtheme: subthemeId,
      selectedGroup: undefined,
    }),

  setSelectedGroup: groupId =>
    set({
      selectedGroup: groupId,
    }),

  // Form actions
  setNewTheme: name => set({ newTheme: name }),
  setNewSubtheme: name => set({ newSubtheme: name }),
  setNewGroup: name => set({ newGroup: name }),
  setNewThemePrefix: prefix => set({ newThemePrefix: prefix }),
  setNewSubthemePrefix: prefix => set({ newSubthemePrefix: prefix }),
  setNewGroupPrefix: prefix => set({ newGroupPrefix: prefix }),

  clearNewTheme: () => set({ newTheme: '', newThemePrefix: '' }),
  clearNewSubtheme: () => set({ newSubtheme: '', newSubthemePrefix: '' }),
  clearNewGroup: () => set({ newGroup: '', newGroupPrefix: '' }),

  reset: () =>
    set({
      selectedTheme: undefined,
      selectedSubtheme: undefined,
      selectedGroup: undefined,
      newTheme: '',
      newSubtheme: '',
      newGroup: '',
      newThemePrefix: '',
      newSubthemePrefix: '',
      newGroupPrefix: '',
    }),
}));
