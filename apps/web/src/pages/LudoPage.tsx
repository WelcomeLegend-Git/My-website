import { useParams } from "react-router-dom";

import { LudoArena } from "../features/ludo";

/** Public by design: invite links can open a Ludo room without website login. */
export const LudoPage = () => {
  const { code } = useParams<{ code?: string }>();

  return <LudoArena initialRoomCode={code} />;
};
