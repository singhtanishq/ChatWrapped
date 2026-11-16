/** UI-only ephemeral state (dialogs) kept outside the main store. */
import { create } from "zustand";

interface UiState {
  privacyOpen: boolean;
  openPrivacyDialog: () => void;
  closePrivacyDialog: () => void;
}

export const useUi = create<UiState>((set) => ({
  privacyOpen: false,
  openPrivacyDialog: () => set({ privacyOpen: true }),
  closePrivacyDialog: () => set({ privacyOpen: false }),
}));

export const openPrivacyDialog = () => useUi.getState().openPrivacyDialog();
export const closePrivacyDialog = () => useUi.getState().closePrivacyDialog();
