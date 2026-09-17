import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, rollDice } from "../game/engine";
import { Dice3D } from "./Dice3D";
import { LudoBoard } from "./LudoBoard";
import { PassDeviceOverlay } from "./PassDeviceOverlay";
import { LudoDialog } from "./LudoDialog";
import { useState } from "react";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const game = () => createGame({ id: "ui-test", mode: "pass", now: 1000, players: [
  { id: "red", name: "Rhea", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "Ben", color: "blue", isBot: false, connection: "ready" },
] });

describe("Accessible Ludo controls", () => {
  it("exposes token buttons inside a group and supports Enter and Space", () => {
    const select = vi.fn();
    render(<LudoBoard state={rollDice(game(), 6, 1100)} onTokenSelect={select} />);
    expect(screen.getByRole("group", { name: "Ludo token board" })).toBeInTheDocument();
    const tokens = screen.getAllByRole("button");
    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toHaveAccessibleName(/Rhea.*token 1.*yard.*legal move/);
    fireEvent.keyDown(tokens[0], { key: "Enter" });
    fireEvent.keyDown(tokens[1], { key: " " });
    expect(select.mock.calls).toEqual([[0], [1]]);
  });

  it("removes selectable controls when interaction is locked", () => {
    render(<LudoBoard state={rollDice(game(), 6, 1100)} onTokenSelect={vi.fn()} interactionDisabled />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("restores focus to the opener after a dialog closes", async () => {
    const Fixture = () => {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Open results</button>
        {open && <LudoDialog title="Results" onClose={() => setOpen(false)}>
          <button data-autofocus onClick={() => setOpen(false)}>Close results</button>
        </LudoDialog>}
      </>;
    };
    render(<Fixture />);
    const opener = screen.getByRole("button", { name: "Open results" });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "Close results" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    fireEvent.click(close);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("focuses the handoff action and does not bypass it with Escape", async () => {
    const ready = vi.fn();
    render(<PassDeviceOverlay playerName="Rhea" onReady={ready} />);
    const button = screen.getByRole("button", { name: "I’m Rhea — ready" });
    expect(screen.getByRole("dialog", { name: "Pass the device to Rhea" })).toBeInTheDocument();
    await waitFor(() => expect(button).toHaveFocus());
    fireEvent.keyDown(button, { key: "Escape" });
    expect(ready).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(ready).toHaveBeenCalledOnce();
  });
});

describe("Dice landing", () => {
  it.each([
    [1, "rotateX(0deg) rotateY(0deg)"], [2, "rotateX(-90deg) rotateY(0deg)"],
    [3, "rotateX(0deg) rotateY(-90deg)"], [4, "rotateX(0deg) rotateY(90deg)"],
    [5, "rotateX(90deg) rotateY(0deg)"], [6, "rotateX(0deg) rotateY(180deg)"],
  ])("preserves face %i throughout the landing bounce", (value, transform) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.useFakeTimers();
    const props = { value: value as number, isReady: false, glowColor: "red", onRoll: vi.fn(), ariaLabel: "Dice" };
    const { container, rerender } = render(<Dice3D {...props} isRolling />);
    rerender(<Dice3D {...props} isRolling={false} />);
    expect(container.querySelector(".dice3d-cube")).toHaveStyle({ transform });
    expect(container.querySelector(".dice3d-bounce-shell")).toHaveClass("just-landed");
    expect(container.querySelector(".dice3d-cube")).not.toHaveClass("just-landed");
    act(() => { vi.advanceTimersByTime(320); });
    expect(container.querySelector(".dice3d-bounce-shell")).not.toHaveClass("just-landed");
    expect(container.querySelector(".dice3d-cube")).toHaveStyle({ transform });
  });

  it("cancels the landing timer when unmounted", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.useFakeTimers();
    const props = { value: 6, isReady: false, glowColor: "red", onRoll: vi.fn(), ariaLabel: "Dice" };
    const { rerender, unmount } = render(<Dice3D {...props} isRolling />);
    rerender(<Dice3D {...props} isRolling={false} />);
    const clear = vi.spyOn(globalThis, "clearTimeout");
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("does not tumble or schedule a bounce with reduced motion", () => {
    vi.useFakeTimers();
    const props = { value: 4, isReady: false, glowColor: "red", onRoll: vi.fn(), ariaLabel: "Dice showing 4" };
    const { container, rerender } = render(<Dice3D {...props} isRolling />);
    expect(container.querySelector(".is-rolling")).toBeNull();
    rerender(<Dice3D {...props} isRolling={false} />);
    expect(container.querySelector(".just-landed")).toBeNull();
    expect(screen.getByRole("button", { name: "Dice showing 4" })).toBeDisabled();
  });
});
