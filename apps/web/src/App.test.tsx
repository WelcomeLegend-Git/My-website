import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";

describe("App", () => {
  it("renders the login heading when unauthenticated", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>
    );
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });
});