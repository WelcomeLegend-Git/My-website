import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { RemoteBridgePage } from "./RemoteBridgePage";

const authMock = vi.hoisted(() => ({
  state: {
    accessToken: "test-access-token",
    user: { id: "user-1", email: "user1@example.com" },
  },
}));

vi.mock("../../lib/auth-storage", () => ({
  authStorage: {
    getState: () => authMock.state,
    getAccessToken: () => authMock.state.accessToken,
  },
}));

vi.mock("../../lib/api", () => ({
  getApiBaseUrl: () => "https://bridge.example.invalid",
  authenticatedFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ phoneOnline: false }),
  }),
}));

const bridgeState = {
  status: {
    connected: true,
    authenticated: true,
    authError: null as string | null,
    phoneOnline: false,
    currentCall: null,
  },
  acceptCall: vi.fn(),
  rejectCall: vi.fn(),
  hangupCall: vi.fn(),
  toggleMute: vi.fn(),
  toggleSpeaker: vi.fn(),
  holdCall: vi.fn(),
  unholdCall: vi.fn(),
  requestStatus: vi.fn(),
  getRecentCalls: vi.fn(),
  dialNumber: vi.fn(),
  setPhoneOnline: vi.fn(),
};

vi.mock("../../lib/use-remote-bridge", () => ({
  useRemoteBridge: () => bridgeState,
}));

describe("Stage 3: Web Bridge Account Binding & Revocation", () => {
  const configKey = "aura-remote-bridge-config";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    bridgeState.status.authError = null;
    authMock.state = {
      accessToken: "test-access-token",
      user: { id: "user-1", email: "user1@example.com" },
    };
  });

  it("clears config if stored userId does not match current user", async () => {
    localStorage.setItem(
      configKey,
      JSON.stringify({
        encryptionKey: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=",
        deviceId: "tablet_123",
        userId: "other-user-999",
      })
    );

    render(<RemoteBridgePage />);

    await waitFor(() => {
      expect(localStorage.getItem(configKey)).toBeNull();
    });
  });

  it("keeps config when stored userId matches current user", async () => {
    localStorage.setItem(
      configKey,
      JSON.stringify({
        encryptionKey: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=",
        deviceId: "tablet_123",
        userId: "user-1",
      })
    );

    render(<RemoteBridgePage />);

    expect(localStorage.getItem(configKey)).not.toBeNull();
  });

  it("clears config when authError indicates device removal or key revocation", async () => {
    localStorage.setItem(
      configKey,
      JSON.stringify({
        encryptionKey: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=",
        deviceId: "tablet_123",
        userId: "user-1",
      })
    );

    bridgeState.status.authError = "Device removed by owner";

    render(<RemoteBridgePage />);

    await waitFor(() => {
      expect(localStorage.getItem(configKey)).toBeNull();
    });
  });
});
