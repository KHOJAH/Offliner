// src/renderer/stores/uiStore.ts
import { create } from 'zustand';
import type { Toast } from '@/types';

interface UIState {
  activeTab: string;
  toasts: Toast[];
  modals: Set<string>;
  setActiveTab: (tab: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  openModal: (name: string) => void;
  closeModal: (name: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: '/',
  toasts: [],
  modals: new Set(),

  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
  },

  addToast: (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 5000 };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, newToast.duration);
  },

  removeToast: (id: string) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  openModal: (name: string) => {
    set((state) => {
      const next = new Set(state.modals);
      next.add(name);
      return { modals: next };
    });
  },

  closeModal: (name: string) => {
    set((state) => {
      const next = new Set(state.modals);
      next.delete(name);
      return { modals: next };
    });
  },
}));
