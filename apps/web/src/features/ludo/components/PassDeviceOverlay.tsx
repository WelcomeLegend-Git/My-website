import { Hand } from "lucide-react";
import { LudoDialog } from "./LudoDialog";

interface PassDeviceOverlayProps {
  playerName: string;
  onReady: () => void;
}

// An explicit handoff avoids accidentally starting another player's clock with Escape.
const keepHandoffOpen = (): void => {};

export const PassDeviceOverlay = ({ playerName, onReady }: PassDeviceOverlayProps) => (
  <LudoDialog
    title={`Pass the device to ${playerName}`}
    eyebrow="Pass & play"
    onClose={keepHandoffOpen}
    decoration={<span className="ludo-pass-icon"><Hand size={29} /></span>}
  >
    <p>The next turn begins when you’re ready. Pass the device, then continue.</p>
    <button data-autofocus type="button" className="ludo-primary-button ludo-full-button" onClick={onReady}>
      I’m {playerName} — ready
    </button>
  </LudoDialog>
);
