import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";

interface LudoDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  decoration?: ReactNode;
  eyebrow?: string;
}

export const LudoDialog = ({ title, onClose, children, decoration, eyebrow }: LudoDialogProps) => (
  <Dialog open onClose={onClose} className="ludo-arena ludo-dialog-root">
    <div className="ludo-dialog-backdrop" aria-hidden="true" />
    <div className="ludo-dialog-scroll">
      <DialogPanel className="ludo-result-card">
        {decoration && <div aria-hidden="true">{decoration}</div>}
        {eyebrow && <span className="ludo-eyebrow">{eyebrow}</span>}
        <DialogTitle as="h2">{title}</DialogTitle>
        {children}
      </DialogPanel>
    </div>
  </Dialog>
);
