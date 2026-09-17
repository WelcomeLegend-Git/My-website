import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../../packages/shared/test-fixtures/bridge-pairing.json";
import { authenticatedFetch } from "../../lib/auth-fetch";
import { getApiBaseUrl } from "../../lib/env";
import { RemoteBridgePage, SetupScreen } from "./RemoteBridgePage";

vi.mock("../../lib/auth-fetch", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("../../lib/env", () => ({ getApiBaseUrl: vi.fn() }));
vi.mock("../../lib/auth-storage", () => ({ authStorage: { getState: () => ({}) } }));
vi.mock("../../lib/use-remote-bridge", () => ({ useRemoteBridge: () => ({ status: { authenticated: false, recentCalls: [] } }) }));
vi.mock("./BridgeDiagnosticsPanel", () => ({ BridgeDiagnosticsPanel: () => null }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-payload">{value}</div> }));

const { encryptionKey, pairingId, pairingToken } = fixture;
const payload = (base = fixture.serverBase) => ({ s: base, p: pairingId, t: pairingToken, k: encryptionKey });
const session = { pairingId, pairingToken, encryptionKey, code: fixture.code, expiresInSeconds: fixture.expiresInSeconds, qrPayload: JSON.stringify(payload()) };
const fetchMock = vi.mocked(authenticatedFetch);
const configKey = "aura-remote-bridge-config";
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const registrations = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/devices/register"));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function mount(ui: React.ReactElement) {
  const view = render(ui);
  await act(async () => {});
  return view;
}
async function tick(ms = 2000) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.mocked(getApiBaseUrl).mockReturnValue(fixture.serverBase);
  localStorage.clear();
  localStorage.setItem("aura-remote-bridge-device-id", fixture.tabletDeviceId);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected real fetch"); }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("normal bridge setup", () => {
  it.each(fixture.validServerBases)("renders QR and Base64 JSON manual code from the creating backend: %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    fetchMock.mockResolvedValue(response({ ...session, qrPayload: JSON.stringify(payload(base)) }));
    await mount(<SetupScreen onQrPaired={vi.fn()} />);
    const expected = payload(base.replace(/\/$/, ""));
    expect(JSON.parse(screen.getByTestId("qr-payload").textContent!)).toEqual(expected);
    expect(fetchMock.mock.calls[0][0]).toBe(`${expected.s}/api/remote-bridge/pairing/create`);
    fireEvent.click(screen.getByRole("button", { name: /manual connection code/i }));
    await act(async () => {});
    const encoded = screen.getByLabelText("Base64 connection code").textContent!;
    expect(JSON.parse(atob(encoded))).toEqual(expected);
    expect(screen.getByText(/not the 6-digit Personal Ecosystem code/i)).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ type: "manual" });
  });

  it.each(fixture.invalidServerBases)("rejects invalid base before creation: %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    await mount(<SetupScreen onQrPaired={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("rejects an advertised QR from a different backend", async () => {
    fetchMock.mockResolvedValue(response({ ...session, qrPayload: JSON.stringify(payload("https://other.example.invalid")) }));
    await mount(<SetupScreen onQrPaired={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/does not match/);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["http", "network"])("never signals success on %s registration failure; retries the same key once", async (failure) => {
    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({ status: "confirmed", encryptionKey }));
    if (failure === "http") fetchMock.mockResolvedValue(response({}, false));
    else fetchMock.mockRejectedValue(new TypeError("Offline"));
    const onQrPaired = vi.fn();
    await mount(<SetupScreen onQrPaired={onQrPaired} />);
    await tick();
    expect(onQrPaired).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/registration.*retry/i);
    await tick(300_000);
    const retry = deferred<Response>();
    fetchMock.mockReturnValue(retry.promise);
    const button = screen.getByRole("button", { name: /retry registration/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(registrations()).toHaveLength(2);
    expect(onQrPaired).not.toHaveBeenCalled();
    await act(async () => { retry.resolve(response({ success: true })); });
    expect(onQrPaired).toHaveBeenCalledTimes(1);
    expect(onQrPaired).toHaveBeenCalledWith(encryptionKey);
    for (const [, options] of registrations()) expect(JSON.parse(String(options?.body))).toMatchObject({ encryptionKey, deviceId: fixture.tabletDeviceId });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/pairing/create"))).toHaveLength(1);
  });

  it.each(["http", "network"])("does not persist after %s registration failure", async (failure) => {
    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({ status: "confirmed", encryptionKey }));
    if (failure === "http") fetchMock.mockResolvedValue(response({}, false));
    else fetchMock.mockRejectedValue(new TypeError("Offline"));
    await mount(<RemoteBridgePage />);
    await tick();
    expect(localStorage.getItem(configKey)).toBeNull();
    fetchMock.mockResolvedValue(response({ success: true }));
    fireEvent.click(screen.getByRole("button", { name: /retry registration/i }));
    await act(async () => {});
    expect(JSON.parse(localStorage.getItem(configKey)!)).toEqual({ encryptionKey, deviceId: fixture.tabletDeviceId });
  });

  it.each(["creation", "confirmation"])("rejects invalid %s key before persistence", async (stage) => {
    fetchMock.mockResolvedValueOnce(response(stage === "creation" ? { ...session, encryptionKey: fixture.invalidEncryptionKeys[2] } : session))
      .mockResolvedValue(response({ status: "confirmed", encryptionKey: fixture.invalidEncryptionKeys[2] }));
    await mount(<RemoteBridgePage />);
    await tick();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(registrations()).toHaveLength(0);
    expect(localStorage.getItem(configKey)).toBeNull();
  });

  it("does not overlap slow polling or repeat registration after callback changes", async () => {
    const status = deferred<Response>();
    const registration = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(session)).mockReturnValueOnce(status.promise).mockReturnValue(registration.promise);
    const view = await mount(<SetupScreen onQrPaired={vi.fn()} />);
    await tick(8000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { status.resolve(response({ status: "confirmed", encryptionKey })); });
    const onQrPaired = vi.fn();
    view.rerender(<SetupScreen onQrPaired={onQrPaired} />);
    await tick(8000);
    expect(registrations()).toHaveLength(1);
    await act(async () => { registration.resolve(response({ success: true })); });
    expect(onQrPaired).toHaveBeenCalledTimes(1);
  });

  it("ignores registration completion after page unmount", async () => {
    const registration = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({ status: "confirmed", encryptionKey })).mockReturnValue(registration.promise);
    const view = await mount(<RemoteBridgePage />);
    await tick();
    view.unmount();
    await act(async () => { registration.resolve(response({ success: true })); });
    expect(localStorage.getItem(configKey)).toBeNull();
  });

  it.each(["unmount", "new session"])("ignores late creation after %s", async (action) => {
    const creation = deferred<Response>();
    fetchMock.mockReturnValueOnce(creation.promise).mockResolvedValue(response(session));
    const onQrPaired = vi.fn();
    const view = await mount(<SetupScreen onQrPaired={onQrPaired} />);
    if (action === "unmount") view.unmount();
    else {
      fireEvent.click(screen.getByRole("button", { name: /manual connection code/i }));
      await act(async () => {});
    }
    await act(async () => { creation.resolve(response({ ...session, qrPayload: "invalid old response" })); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onQrPaired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(action === "unmount" ? 1 : 2);
  });

  it("ignores old confirmation when a replacement creation is pending", async () => {
    const status = deferred<Response>();
    const creation = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(session)).mockReturnValueOnce(status.promise).mockReturnValueOnce(creation.promise);
    const onQrPaired = vi.fn();
    await mount(<SetupScreen onQrPaired={onQrPaired} />);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await act(async () => { status.resolve(response({ status: "confirmed", encryptionKey })); });
    expect(registrations()).toHaveLength(0);
    expect(onQrPaired).not.toHaveBeenCalled();
    await act(async () => { creation.resolve(response(session)); });
  });
});
