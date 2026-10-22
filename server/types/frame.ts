export interface Frame {
  seq: number;
  buttons: number;
  cp: [number, number]; // Circle Pad [X, Y]
  tp: [number, number]; // Touch Pad [X, Y]
  cs: [number, number]; // C-Stick [X, Y]
  ir: number;
  csStatus: number;
  wifi: number;
  wifiRecoveries: number;
  irError: number;
  csError: number;
}

export const FRAME_SIZE = 32;

export const BUTTON_MAP: Record<number, string> = {
  0: "A", 1: "B", 2: "Select", 3: "Start",
  4: "D-pad Right", 5: "D-pad Left", 6: "D-pad Up", 7: "D-pad Down",
  8: "R", 9: "L", 10: "X", 11: "Y",
  14: "ZL", 15: "ZR", 16: "HOME",
  24: "C-stick Right", 25: "C-stick Left", 26: "C-stick Up", 27: "C-stick Down",
  28: "Circle pad Right", 29: "Circle pad Left", 30: "Circle pad Up", 31: "Circle pad Down",
};

export const isPressed = (buttons: number, bit: number): boolean => {
  return ((buttons >>> bit) & 1) === 1;
};

/**
 * Returns a record of all button names and their pressed state.
 * Useful for rendering the UI (e.g., { "A": true, "B": false ... })
 */
export const getButtonStates = (buttons: number): Record<string, boolean> => {
  const states: Record<string, boolean> = {};
  for (const [bit, name] of Object.entries(BUTTON_MAP) as unknown as [number, string][]) {
    states[name] = isPressed(buttons, bit);
  }
  return states;
};

/**
 * Returns only the names of the buttons that are currently pressed.
 */
export const getPressedButtons = (buttons: number): string[] => {
  return (Object.entries(BUTTON_MAP) as unknown as [number, string][])
    .filter(([bit, _]) => isPressed(buttons, bit))
    .map(([_, name]) => name);
};