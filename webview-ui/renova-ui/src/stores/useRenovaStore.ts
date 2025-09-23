/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

type State = {
  currentWorkspaceId?: string;
  switchWorkspace: (id?: string) => void;
};
export const useRenovaStore = create<State>((set: (arg0: { currentWorkspaceId: any; }) => any) => ({
  currentWorkspaceId: undefined,
  switchWorkspace: (id: any) => set({ currentWorkspaceId: id }),
}));
