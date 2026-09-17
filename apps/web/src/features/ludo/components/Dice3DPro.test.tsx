import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dice3DPro, DICE_FACE_ROTATIONS, type PlayerColor, type ArrowDirection } from "./Dice3DPro";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Dice3DPro component", () => {
  it.each([
    [1, DICE_FACE_ROTATIONS[1]],
    [2, DICE_FACE_ROTATIONS[2]],
    [3, DICE_FACE_ROTATIONS[3]],
    [4, DICE_FACE_ROTATIONS[4]],
    [5, DICE_FACE_ROTATIONS[5]],
    [6, DICE_FACE_ROTATIONS[6]],
  ])("renders 3D cube flush on face %i with transform %s", (val, expectedTransform) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    const onRoll = vi.fn();
    const { container } = render(
      <Dice3DPro
        value={val}
        isRolling={false}
        isReady={false}
        playerColor="blue"
        onRoll={onRoll}
      />
    );

    const cube = container.querySelector(".dice3d-pro-cube");
    expect(cube).not.toBeNull();
    expect(cube).toHaveStyle({ transform: expectedTransform });
  });

  it("renders all 6 faces with accurate pip counts", () => {
    const { container } = render(
      <Dice3DPro
        value={1}
        isRolling={false}
        isReady={true}
        playerColor="red"
        onRoll={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".dice3d-pro-face")).toHaveLength(6);
    expect(container.querySelectorAll(".dice3d-pro-face-1 .dice3d-pro-pip")).toHaveLength(1);
    expect(container.querySelectorAll(".dice3d-pro-face-2 .dice3d-pro-pip")).toHaveLength(2);
    expect(container.querySelectorAll(".dice3d-pro-face-3 .dice3d-pro-pip")).toHaveLength(3);
    expect(container.querySelectorAll(".dice3d-pro-face-4 .dice3d-pro-pip")).toHaveLength(4);
    expect(container.querySelectorAll(".dice3d-pro-face-5 .dice3d-pro-pip")).toHaveLength(5);
    expect(container.querySelectorAll(".dice3d-pro-face-6 .dice3d-pro-pip")).toHaveLength(6);
  });

  it("applies tumbling and hop animations when rolling, then transitions to double-bounce settle", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    vi.useFakeTimers();

    const onRoll = vi.fn();
    const { container, rerender } = render(
      <Dice3DPro
        value={3}
        isRolling={true}
        isReady={false}
        playerColor="green"
        onRoll={onRoll}
      />
    );

    const hopShell = container.querySelector(".dice3d-pro-hop-shell");
    const tumbler = container.querySelector(".dice3d-pro-tumbler");
    const shadow = container.querySelector(".dice3d-pro-shadow");

    expect(hopShell).toHaveClass("is-hopping");
    expect(shadow).toHaveClass("is-hopping");
    expect(tumbler?.className).toMatch(/is-tumble-\d/);

    // Stop rolling -> transition to landing
    rerender(
      <Dice3DPro
        value={5}
        isRolling={false}
        isReady={false}
        playerColor="green"
        onRoll={onRoll}
      />
    );

    expect(container.querySelector(".dice3d-pro-hop-shell")).toHaveClass("is-landing");
    expect(container.querySelector(".dice3d-pro-shadow")).toHaveClass("is-landing");
    expect(container.querySelector(".dice3d-pro-cube")).toHaveStyle({
      transform: DICE_FACE_ROTATIONS[5],
    });

    // Advance past landing duration (340ms)
    act(() => {
      vi.advanceTimersByTime(340);
    });

    expect(container.querySelector(".dice3d-pro-hop-shell")).not.toHaveClass("is-landing");
    expect(container.querySelector(".dice3d-pro-shadow")).not.toHaveClass("is-landing");
  });

  it("cleans up bounce timer on unmount", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const { rerender, unmount } = render(
      <Dice3DPro
        value={2}
        isRolling={true}
        isReady={false}
        playerColor="yellow"
        onRoll={vi.fn()}
      />
    );

    rerender(
      <Dice3DPro
        value={2}
        isRolling={false}
        isReady={false}
        playerColor="yellow"
        onRoll={vi.fn()}
      />
    );

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it.each([
    ["red" as PlayerColor, "#ff4f70"],
    ["blue" as PlayerColor, "#3b9dff"],
    ["yellow" as PlayerColor, "#f7c84b"],
    ["green" as PlayerColor, "#32d39a"],
  ])("configures player theme variables for %s", (playerColor, expectedHex) => {
    const { container } = render(
      <Dice3DPro
        value={4}
        isRolling={false}
        isReady={true}
        playerColor={playerColor}
        onRoll={vi.fn()}
      />
    );

    const button = container.querySelector(".dice3d-pro-scene") as HTMLElement;
    expect(button.style.getPropertyValue("--player-color")).toBe(expectedHex);
  });

  it.each([
    ["right" as ArrowDirection],
    ["left" as ArrowDirection],
    ["down" as ArrowDirection],
    ["up" as ArrowDirection],
  ])("renders corner pointing arrow for direction: %s", (direction) => {
    const { container } = render(
      <Dice3DPro
        value={6}
        isRolling={false}
        isReady={true}
        playerColor="red"
        arrowDirection={direction}
        onRoll={vi.fn()}
      />
    );

    const arrow = container.querySelector(`.dice3d-pro-arrow-${direction}`);
    expect(arrow).not.toBeNull();
    expect(arrow).toHaveAttribute("data-direction", direction);
  });

  it("hides pointing arrow when rolling or when not ready", () => {
    const { container, rerender } = render(
      <Dice3DPro
        value={6}
        isRolling={false}
        isReady={false}
        playerColor="red"
        arrowDirection="right"
        onRoll={vi.fn()}
      />
    );
    expect(container.querySelector(".dice3d-pro-arrow")).toBeNull();

    rerender(
      <Dice3DPro
        value={6}
        isRolling={true}
        isReady={true}
        playerColor="red"
        arrowDirection="right"
        onRoll={vi.fn()}
      />
    );
    expect(container.querySelector(".dice3d-pro-arrow")).toBeNull();
  });

  it("handles click and keyboard (Enter / Space) interaction when ready", () => {
    const onRoll = vi.fn();
    render(
      <Dice3DPro
        value={null}
        isRolling={false}
        isReady={true}
        playerColor="yellow"
        onRoll={onRoll}
      />
    );

    const button = screen.getByRole("button", { name: "Your turn to roll" });
    expect(button).toBeEnabled();

    // Click
    fireEvent.click(button);
    expect(onRoll).toHaveBeenCalledTimes(1);

    // Enter key
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onRoll).toHaveBeenCalledTimes(2);

    // Space key
    fireEvent.keyDown(button, { key: " " });
    expect(onRoll).toHaveBeenCalledTimes(3);
  });

  it("respects custom ariaLabel and size props", () => {
    const { container } = render(
      <Dice3DPro
        value={4}
        isRolling={false}
        isReady={false}
        playerColor="blue"
        ariaLabel="Ruby player dice rolled 4"
        size={72}
        onRoll={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Ruby player dice rolled 4" });
    expect(button).toBeDisabled();
    expect(button.style.getPropertyValue("--dice-size")).toBe("72px");
  });

  it("respects prefers-reduced-motion without rolling tumble or bounce", () => {
    // Stub matchMedia to return true for reduced-motion
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    vi.useFakeTimers();

    const { container, rerender } = render(
      <Dice3DPro
        value={1}
        isRolling={true}
        isReady={false}
        playerColor="red"
        onRoll={vi.fn()}
      />
    );

    expect(container.querySelector(".is-hopping")).toBeNull();
    expect(container.querySelector(".is-tumble-0")).toBeNull();

    rerender(
      <Dice3DPro
        value={1}
        isRolling={false}
        isReady={false}
        playerColor="red"
        onRoll={vi.fn()}
      />
    );

    expect(container.querySelector(".is-landing")).toBeNull();
  });
});
