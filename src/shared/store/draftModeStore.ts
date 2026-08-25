import { create } from 'zustand';

export type DraftMode = 'classic' | 'purist';

type DraftModeStore = {
  draftMode: DraftMode;
  setDraftMode: (mode: DraftMode) => void;
};

// MGC-656: store compartido entre el form de identidad (MGC-655) y el
// preview del home. Atomico, sin persist: la elección de modo vive en la
// sesión activa del draft y no se guarda entre carreras (MGC-655 lo
// re-sincroniza al entrar al flow).
export const useDraftModeStore = create<DraftModeStore>((set) => ({
  draftMode: 'classic',
  setDraftMode: (mode) => set({ draftMode: mode }),
}));