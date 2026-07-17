import { Hand, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface PassDeviceOverlayProps {
  playerName: string;
  onReady: () => void;
}

export const PassDeviceOverlay = ({ playerName, onReady }: PassDeviceOverlayProps) => (
  <motion.div
    className="ludo-pass-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="pass-device-title"
  >
    <motion.div
      className="ludo-pass-card"
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 21 }}
    >
      <span className="ludo-pass-icon"><Hand size={29} /></span>
      <span className="ludo-eyebrow">PASS & PLAY</span>
      <h2 id="pass-device-title">Pass the device to {playerName}</h2>
      <p>Your board is hidden until the next player is ready. Keep the strategy secret.</p>
      <button type="button" className="ludo-primary-button" onClick={onReady}>
        <ShieldCheck size={18} /> I’m {playerName}
      </button>
    </motion.div>
  </motion.div>
);
