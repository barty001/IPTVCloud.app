'use client';

import { create } from 'zustand';

type PlayerStore = {
  selectedChannelId: string | null;
  lastChannelId: string | null;
  viewMode: 'grid' | 'list';
  theaterMode: boolean;
  ambientMode: boolean;
  setSelectedChannelId: (_channelId: string | null) => void;
  setLastChannelId: (_channelId: string | null) => void;
  setViewMode: (_viewMode: 'grid' | 'list') => void;
  setTheaterMode: (_theaterMode: boolean) => void;
  setAmbientMode: (_ambientMode: boolean) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  selectedChannelId: null,
  lastChannelId: null,
  viewMode: 'grid',
  theaterMode: false,
  ambientMode: true,
  setSelectedChannelId: (selectedChannelId) => set({ selectedChannelId }),
  setLastChannelId: (lastChannelId) => set({ lastChannelId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setTheaterMode: (theaterMode) => set({ theaterMode }),
  setAmbientMode: (ambientMode) => set({ ambientMode }),
}));
