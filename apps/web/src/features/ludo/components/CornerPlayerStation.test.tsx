import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CornerPlayerStation } from "./CornerPlayerStation";
import { createGame, rollDice } from "../game/engine";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const makeGame = () =>
  createGame({
    id: "station-test",
    mode: "single",
    now: 1000,
    players: [
      { id: "red", name: "Rhea", color: "red", isBot: false, connection: "ready" },
      { id: "blue", name: "Nova", color: "blue", isBot: true, connection: "bot" },
    ],
  });

describe("CornerPlayerStation component", () => {
  it("renders player profile with initial and home token counter", () => {
    const state = makeGame();
    const player = state.players[0];

    const { container } = render(
      <CornerPlayerStation
        player={player}
        state={state}
        isActive={true}
        isDiceRolling={false}
        canRoll={true}
        onRoll={vi.fn()}
        corner="top-left"
      />,
    );

    expect(screen.getByText("Rhea")).toBeInTheDocument();
    expect(screen.getByText("0/4 home")).toBeInTheDocument();
    expect(container.querySelector(".ludo-station-avatar")?.textContent).toBe("R");
    expect(container.querySelector(".ludo-corner-station")).toHaveClass("is-active");
    expect(container.querySelector(".ludo-corner-station")).toHaveClass("ludo-corner-top-left");
  });

  it("renders bot icon for bot players and supports top-right corner orientation", () => {
    const state = makeGame();
    const botPlayer = state.players[1];

    const { container } = render(
      <CornerPlayerStation
        player={botPlayer}
        state={state}
        isActive={false}
        isDiceRolling={false}
        canRoll={false}
        onRoll={vi.fn()}
        corner="top-right"
      />,
    );

    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText("0/4 home · Bot")).toBeInTheDocument();
    expect(container.querySelector(".ludo-corner-station")).toHaveClass("ludo-corner-top-right");
    expect(container.querySelector(".ludo-corner-station")).not.toHaveClass("is-active");
  });

  it("triggers onRoll when active player clicks rollable dice", () => {
    const state = makeGame();
    const player = state.players[0];
    const onRoll = vi.fn();

    render(
      <CornerPlayerStation
        player={player}
        state={state}
        isActive={true}
        isDiceRolling={false}
        canRoll={true}
        onRoll={onRoll}
        corner="top-left"
      />,
    );

    const rollBtn = screen.getByRole("button", { name: "Rhea's turn to roll the dice" });
    expect(rollBtn).not.toBeDisabled();
    fireEvent.click(rollBtn);
    expect(onRoll).toHaveBeenCalledOnce();
  });

  it("disables rolling when interactionLocked is true", () => {
    const state = makeGame();
    const player = state.players[0];
    const onRoll = vi.fn();

    render(
      <CornerPlayerStation
        player={player}
        state={state}
        isActive={true}
        isDiceRolling={false}
        canRoll={true}
        onRoll={onRoll}
        corner="top-left"
        interactionLocked={true}
      />,
    );

    const diceBtn = screen.getByRole("button", { name: "Rhea's dice" });
    expect(diceBtn).toBeDisabled();
    fireEvent.click(diceBtn);
    expect(onRoll).not.toHaveBeenCalled();
  });
});
