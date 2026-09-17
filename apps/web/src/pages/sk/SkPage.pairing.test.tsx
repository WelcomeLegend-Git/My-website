import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "../../lib/auth-fetch";
import { getApiBaseUrl } from "../../lib/env";
import fixture from "../../../../../packages/shared/test-fixtures/bridge-pairing.json";
import { SetupScreen, SkPage } from "./SkPage";

vi.mock("../../lib/auth-fetch", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("../../lib/env", () => ({ getApiBaseUrl: vi.fn() }));
vi.mock("../../lib/auth-storage", () => ({ authStorage: { getState: () => ({}) } }));
vi.mock("../../lib/use-remote-bridge", () => ({
  useRemoteBridge: () => ({ status: { authenticated: false, recentCalls: [] } }),
}));
vi.mock("./BridgeDiagnosticsPanel", () => ({ BridgeDiagnosticsPanel: () => null }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-payload">{value}</div> }));

// Read the canonical fixture directly; Android consumes its byte-identical resource copy.
const { encryptionKey, pairingId, pairingToken } = fixture;
const session = {
  pairingId,
  code: fixture.code,
  qrPayload: JSON.stringify({ s: fixture.serverBase, p: pairingId, t: pairingToken, k: encryptionKey }),
  expiresInSeconds: fixture.expiresInSeconds,
  encryptionKey,
  pairingToken,
};
const nextSessionData = {
  ...session, pairingId: "new-session", code: "654321",
  qrPayload: JSON.stringify({ s: fixture.serverBase, p: "new-session", t: pairingToken, k: encryptionKey }),
};
const configKey = "aura-remote-bridge-config";
const fetchMock = vi.mocked(authenticatedFetch);
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const registrationCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/devices/register"));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function tick(ms = 1500) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

async function mount(ui: React.ReactElement) {
  const view = render(ui);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.mocked(getApiBaseUrl).mockReturnValue(fixture.serverBase);
  localStorage.clear();
  localStorage.setItem("aura-remote-bridge-device-id", fixture.tabletDeviceId);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected real fetch"); }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockPairing(failure: "http" | "network") {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("/pairing/create")) return response(session);
    if (String(url).endsWith("/status")) return response({ status: "confirmed", encryptionKey });
    if (String(url).endsWith("/devices/register")) {
      if (failure === "network") throw new TypeError("Failed to fetch");
      return response({ error: "Internal detail must not be displayed" }, false);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("SetupScreen registration", () => {
  it.each(fixture.validServerBases)("uses the validated creating backend for QR and requests: %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    const canonical = base.replace(/\/$/, "");
    fetchMock.mockResolvedValue(response({ ...session, qrPayload: JSON.stringify({ s: base, p: pairingId, t: pairingToken, k: encryptionKey }) }));
    await mount(<SetupScreen onPaired={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /scan qr code/i }));
    expect(JSON.parse(screen.getByTestId("qr-payload").textContent!)).toEqual({ s: canonical, p: pairingId, t: pairingToken, k: encryptionKey });
    expect(fetchMock.mock.calls[0][0]).toBe(`${canonical}/api/remote-bridge/pairing/create`);
  });

  it.each(fixture.invalidServerBases)("rejects invalid backend before any request: %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    await mount(<SetupScreen onPaired={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("rejects an advertised QR from another backend", async () => {
    fetchMock.mockResolvedValue(response({ ...session, qrPayload: JSON.stringify({ s: "https://other.example.invalid", p: pairingId, t: pairingToken, k: encryptionKey }) }));
    await mount(<SetupScreen onPaired={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/does not match/i);
    await tick(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["creation", "confirmation"])("rejects invalid %s keys without persistence", async (stage) => {
    fetchMock.mockResolvedValueOnce(response(stage === "creation" ? { ...session, encryptionKey: fixture.invalidEncryptionKeys[2] } : session))
      .mockResolvedValue(response({ status: "confirmed", encryptionKey: fixture.invalidEncryptionKeys[2] }));
    await mount(<SkPage />);
    await tick();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(registrationCalls()).toHaveLength(0);
    expect(localStorage.getItem(configKey)).toBeNull();
  });

  it("labels the personal manual format as six digits", async () => {
    fetchMock.mockResolvedValue(response(session));
    await mount(<SetupScreen onPaired={vi.fn()} />);
    expect(screen.getByText(fixture.code)).toBeInTheDocument();
    expect(screen.getByText(/this is not the Base64 connection code/i)).toBeInTheDocument();
  });

  it("asks for the phone-configured password/PIN, not a fixed PIN", async () => {
    localStorage.setItem(configKey, JSON.stringify({ encryptionKey, deviceId: fixture.tabletDeviceId }));
    await mount(<SkPage />);
    fireEvent.click(screen.getByRole("button", { name: /private vault/i }));
    expect(screen.getByText(/password\/PIN configured on your phone/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password/PIN")).toBeInTheDocument();
    expect(screen.queryByText(/878955/)).not.toBeInTheDocument();
  });
  it.each(["http", "network"] as const)("does not call onPaired after %s failure and retries the confirmed key", async (failure) => {
    mockPairing(failure);
    const onPaired = vi.fn();
    await mount(<SetupScreen onPaired={onPaired} />);
    await tick();

    expect(registrationCalls()).toHaveLength(1);
    expect(onPaired).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/registration.*retry/i);
    fireEvent.click(screen.getByRole("button", { name: /scan qr code/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/registration.*retry/i);
    await tick(300_000);
    expect(registrationCalls()).toHaveLength(1);

    fetchMock.mockResolvedValue(response({ success: true }));
    fireEvent.click(screen.getByRole("button", { name: /retry registration/i }));
    await act(async () => {});

    expect(registrationCalls()).toHaveLength(2);
    for (const [, options] of registrationCalls()) {
      expect(JSON.parse(String(options?.body))).toEqual({
        deviceId: fixture.tabletDeviceId, deviceType: "tablet", deviceName: "Web Mirror Hub", encryptionKey,
      });
    }
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/pairing/create"))).toHaveLength(1);
    expect(onPaired).toHaveBeenCalledTimes(1);
    expect(onPaired).toHaveBeenCalledWith(encryptionKey, true);
    await tick(4500);
    expect(onPaired).toHaveBeenCalledTimes(1);
  });

  it.each(["http", "network"] as const)("does not persist bridge config after %s failure", async (failure) => {
    mockPairing(failure);
    await mount(<SkPage />);
    await tick();
    expect(registrationCalls()).toHaveLength(1);
    expect(localStorage.getItem(configKey)).toBeNull();
    expect(screen.getByRole("heading", { name: /connect auraring/i })).toBeInTheDocument();
  });

  it("serializes slow status polls and registration even when the callback changes", async () => {
    const status = deferred<Response>();
    const registration = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(session)).mockReturnValueOnce(status.promise).mockReturnValue(registration.promise);
    const onPaired = vi.fn();
    const view = await mount(<SetupScreen onPaired={vi.fn()} />);
    await tick(6000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { status.resolve(response({ status: "confirmed", encryptionKey })); });
    view.rerender(<SetupScreen onPaired={onPaired} />);
    await tick(6000);
    expect(registrationCalls()).toHaveLength(1);
    expect(onPaired).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /registering device/i })).toBeDisabled();
    await act(async () => { registration.resolve(response({ success: true })); });
    expect(onPaired).toHaveBeenCalledTimes(1);
    expect(onPaired).toHaveBeenCalledWith(encryptionKey, true);
  });

  it("does not complete an old registration after unmount and a new mount", async () => {
    const registration = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(session))
      .mockResolvedValueOnce(response({ status: "confirmed", encryptionKey }))
      .mockReturnValueOnce(registration.promise);
    const oldPaired = vi.fn();
    const view = await mount(<SetupScreen onPaired={oldPaired} />);
    await tick();
    view.unmount();
    fetchMock.mockResolvedValue(response(nextSessionData));
    const newPaired = vi.fn();
    await mount(<SetupScreen onPaired={newPaired} />);
    await act(async () => { registration.resolve(response({ success: true })); });
    expect(oldPaired).not.toHaveBeenCalled();
    expect(newPaired).not.toHaveBeenCalled();
  });

  it("ignores an old status response when Refresh Code starts a new session", async () => {
    const status = deferred<Response>();
    const nextSession = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response({ ...session, expiresInSeconds: 1 }))
      .mockReturnValueOnce(status.promise).mockReturnValueOnce(nextSession.promise);
    const onPaired = vi.fn();
    await mount(<SetupScreen onPaired={onPaired} />);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: /refresh code/i }));
    await act(async () => { status.resolve(response({ status: "confirmed", encryptionKey })); });
    expect(registrationCalls()).toHaveLength(0);
    expect(onPaired).not.toHaveBeenCalled();
    await act(async () => { nextSession.resolve(response(nextSessionData)); });
    expect(screen.getByText("654321")).toBeInTheDocument();
  });

  it("ignores a late session creation response after unmount", async () => {
    const creation = deferred<Response>();
    fetchMock.mockReturnValue(creation.promise);
    const onPaired = vi.fn();
    const view = await mount(<SetupScreen onPaired={onPaired} />);
    view.unmount();
    await act(async () => { creation.resolve(response(session)); });
    await tick(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPaired).not.toHaveBeenCalled();
  });

  it("allows only one in-flight retry and persists only after registration succeeds", async () => {
    mockPairing("http");
    await mount(<SkPage />);
    await tick();
    const retry = deferred<Response>();
    fetchMock.mockReturnValue(retry.promise);
    const button = screen.getByRole("button", { name: /retry registration/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await tick(6000);
    expect(registrationCalls()).toHaveLength(2);
    expect(localStorage.getItem(configKey)).toBeNull();
    await act(async () => { retry.resolve(response({ success: true })); });
    expect(JSON.parse(localStorage.getItem(configKey)!)).toEqual({
      encryptionKey, deviceId: fixture.tabletDeviceId, isPermanent: true,
    });
  });
});
