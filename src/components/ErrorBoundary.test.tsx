// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

let broken = true;
function Flaky() {
  if (broken) throw new Error("falhou aqui");
  return <p>tudo certo</p>;
}

describe("ErrorBoundary", () => {
  afterEach(cleanup);

  it("shows the error instead of a blank page, and retries", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="o catálogo">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("Algo deu errado ao exibir o catálogo.");
    expect(screen.getByRole("alert").textContent).toContain("falhou aqui");

    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByText("tudo certo")).toBeTruthy();
    consoleError.mockRestore();
  });
});
