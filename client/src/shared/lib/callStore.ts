import { create } from 'zustand';

export interface CallContext {
  prospectId?: number;
  prospectName?: string;
  phoneNumber: string;
  campaignId?: number;
  workflowId?: number;
}

interface CallState {
  pendingCall: CallContext | null;
  isSoftphoneOpen: boolean;
  initiateCall: (context: CallContext) => void;
  clearPendingCall: () => void;
  setSoftphoneOpen: (open: boolean) => void;
}

export const useCallStore = create<CallState>((set) => ({
  pendingCall: null,
  isSoftphoneOpen: false,
  initiateCall: (context) => set({ pendingCall: context, isSoftphoneOpen: true }),
  clearPendingCall: () => set({ pendingCall: null }),
  setSoftphoneOpen: (open) => set({ isSoftphoneOpen: open }),
}));
