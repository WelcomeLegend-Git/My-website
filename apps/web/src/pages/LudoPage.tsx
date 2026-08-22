import { LudoArena } from "../features/ludo/LudoArena";

/** Public by design: invite links can open a Ludo room without website login. */
export const LudoPage = () => {
  return <LudoArena />;
};
