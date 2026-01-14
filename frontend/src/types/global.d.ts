declare global {
  interface Window {
    __handlingShiftPress?: boolean;
    __handlingCtrlPress?: boolean;
  }
}

export {};
