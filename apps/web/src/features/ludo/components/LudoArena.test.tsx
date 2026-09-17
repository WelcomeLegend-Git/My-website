import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../game/engine";
import { LudoArena } from "../LudoArena";

const mocks = vi.hoisted(() => ({ victory: vi.fn(), emit: vi.fn(), leave: vi.fn(), restart: vi.fn(), now: 1000, unlock: vi.fn() }));
const finishedGame = createGame({ id: "finished-ui", mode: "single", now: 1000, players: [
  { id: "red", name: "Rhea", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "Ben", color: "blue", isBot: true, connection: "bot" },
] });
finishedGame.phase = "finished";
finishedGame.winnerOrder = ["red", "blue"];

vi.mock("../hooks/useLudoGame", () => ({ useLudoGame: () => ({ game: { ...finishedGame }, now: mocks.now, leave: mocks.leave, restart: mocks.restart }) }));
vi.mock("../hooks/usePeerLudo", () => ({ usePeerLudo: () => ({ game: null, status: "idle", leave: vi.fn() }) }));
// Deliberately unstable API: even a new effect dependency must not repeat victory.
vi.mock("../effects/useParticles", () => ({ useParticles: () => ({ emit: mocks.emit, clear: vi.fn(), bindCanvas: vi.fn() }) }));
vi.mock("../effects/ParticleCanvas", () => ({ ParticleCanvas: () => null }));
vi.mock("./LudoBoard", () => ({ LudoBoard: () => <div>Board</div> }));
vi.mock("../audio/SoundEngine", () => ({ LudoSoundEngine: class {
  muted = false;
  victory = mocks.victory;
  unlock = mocks.unlock;
    stop() {} dispose() {}
} }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Arena victory regression", () => {
  it("celebrates once despite timer rerenders and unstable effect dependencies", async () => {
    const { rerender } = render(<LudoArena />);
    expect(mocks.victory).toHaveBeenCalledOnce();
    mocks.now += 250;
    rerender(<LudoArena />);
    mocks.now += 250;
    rerender(<LudoArena />);
    expect(mocks.victory).toHaveBeenCalledOnce();
    expect(mocks.emit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Rhea" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Play again" })).toHaveFocus());
  });

  it("does not replay victory while a requested rematch is still pending", async () => {
    const { rerender } = render(<LudoArena />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play again" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(mocks.restart).toHaveBeenCalledOnce();
    rerender(<LudoArena />);
    expect(mocks.victory).toHaveBeenCalledOnce();
    expect(mocks.emit).toHaveBeenCalledOnce();
  });

  it("unlocks audio on click-only activation through the dialog portal", async () => {
    render(<LudoArena />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play again" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(mocks.unlock).toHaveBeenCalledOnce();
  });

  it("clears the local game when returning to game modes", async () => {
    render(<LudoArena />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play again" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Back to game modes" }));
    expect(mocks.leave).toHaveBeenCalledOnce();
  });
});
