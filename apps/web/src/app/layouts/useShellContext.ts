import { useOutletContext } from "react-router-dom";
import type { ShellOutletContext } from "./ShellLayout";

export const useShellContext = () => useOutletContext<ShellOutletContext>();