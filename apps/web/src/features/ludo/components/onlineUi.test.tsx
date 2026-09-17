import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeerLudoController } from "../hooks/usePeerLudo";
import { LudoArena } from "../LudoArena";
import { createGame } from "../game/engine";

const mocks = vi.hoisted(() => ({
  hostRoom: vi.fn(), joinRoom: vi.fn(), reconnect: vi.fn(), leave: vi.fn(),
  peer: {} as Partial<PeerLudoController>,
}));
vi.mock("../hooks/useLudoGame", () => ({ useLudoGame: () => ({ game: null, now: 1000, leave: mocks.leave }) }));
vi.mock("../hooks/usePeerLudo", () => ({ usePeerLudo: () => ({
  game: null, status: "idle", lobbyPlayers: [], hostRoom: mocks.hostRoom,
  joinRoom: mocks.joinRoom, reconnect: mocks.reconnect, leave: mocks.leave, ...mocks.peer,
}) }));
vi.mock("../effects/useParticles", () => ({ useParticles: () => ({ emit: vi.fn(), clear: vi.fn(), bindCanvas: vi.fn() }) }));
vi.mock("../effects/ParticleCanvas", () => ({ ParticleCanvas: () => null }));
vi.mock("./LudoBoard", () => ({ LudoBoard: ({ interactionDisabled }: { interactionDisabled: boolean }) => <button disabled={interactionDisabled}>Board token</button> }));
vi.mock("../audio/SoundEngine", () => ({ LudoSoundEngine: class {
  muted = false;
  unlock() {} stop() {} dispose() {} turnChime() {} diceRoll() {} sixRoll() {} tokenMove() {}
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.peer = {};
  window.history.replaceState({}, "", "/ludo");
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });

const secret = "ab".repeat(24);

describe("Online room UI", () => {
  it("forwards generated private admission to the host", () => {
    render(<LudoArena initialRoomCode="12345" />);
    fireEvent.click(screen.getByRole("button", { name: "Create a new room" }));
    fireEvent.click(screen.getByRole("button", { name: "Open room & go live" }));
    expect(mocks.hostRoom).toHaveBeenCalledWith(expect.stringMatching(/^\d{5}$/), "You", expect.stringMatching(/^[a-f0-9]{48}$/));
  });

  it("forwards a deep-linked secret when joining", () => {
    window.history.replaceState({}, "", `/ludo/room/12345?invite=${secret}`);
    render(<LudoArena />);
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(mocks.joinRoom).toHaveBeenCalledWith("12345", "You", secret);
  });

  it("accepts a pasted full link and preserves its secret", () => {
    render(<LudoArena initialRoomCode="12345" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Room number or invite link" }), { target: { value: `https://example.com/ludo/room/54321?invite=${secret}` } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(mocks.joinRoom).toHaveBeenCalledWith("54321", "You", secret);
  });

  it("clears a previous secret when entering a different room code", () => {
    window.history.replaceState({}, "", `/ludo/room/12345?invite=${secret}`);
    render(<LudoArena />);
    fireEvent.change(screen.getByRole("textbox", { name: "Room number or invite link" }), { target: { value: "54321" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(mocks.joinRoom).toHaveBeenCalledWith("54321", "You", undefined);
  });

  it("offers reconnect without clearing the guest session", () => {
    mocks.peer = { status: "closed", role: "guest", error: "Connection lost" };
    render(<LudoArena initialRoomCode="12345" />);
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(mocks.reconnect).toHaveBeenCalledOnce();
    expect(mocks.leave).not.toHaveBeenCalled();
  });

  it("locks dice, skip and token actions on a disconnected snapshot", () => {
    const game = createGame({ id: "online-ui", mode: "online", now: 1000, players: [
      { id: "guest-seat", name: "You", color: "red", isBot: false, connection: "ready" },
      { id: "host-seat", name: "Host", color: "blue", isBot: false, connection: "ready" },
    ] });
    mocks.peer = { status: "closed", role: "guest", mySeatKey: "guest-seat", game, error: "Connection lost" };
    const { rerender } = render(<LudoArena initialRoomCode="12345" />);
    expect(screen.queryByRole("button", { name: "Roll the dice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip this turn" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board token" })).toBeDisabled();
    mocks.peer = { ...mocks.peer, game: { ...game, phase: "moving", diceValue: 6, legalTokenIndexes: [0] } };
    rerender(<LudoArena initialRoomCode="12345" />);
    expect(screen.queryByRole("button", { name: "Move Red token 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeEnabled();
  });

  it("waits for offline humans before enabling start", () => {
    mocks.peer = { status: "lobby", role: "host", lobbyPlayers: [
      { seatKey: "host-seat", name: "Host", color: "red", isBot: false, connection: "ready" },
      { seatKey: "guest-seat", name: "Guest", color: "blue", isBot: false, connection: "offline" },
    ] };
    const { rerender } = render(<LudoArena initialRoomCode="12345" />);
    expect(screen.getByRole("button", { name: "Waiting for players to reconnect" })).toBeDisabled();
    mocks.peer.lobbyPlayers = mocks.peer.lobbyPlayers!.map((seat) => ({ ...seat, connection: "ready" }));
    rerender(<LudoArena initialRoomCode="12345" />);
    expect(screen.getByRole("button", { name: "Start match" })).toBeEnabled();
  });

  it("rejects malformed links without joining", () => {
    render(<LudoArena initialRoomCode="12345" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Room number or invite link" }), { target: { value: "https://example.com/not-a-room" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(mocks.joinRoom).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Invalid Ludo share link.");
  });
});
