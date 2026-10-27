// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VinSearchState } from "../../hooks/useVinSearch";
import { VinSearch } from "./VinSearch";

const done: VinSearchState = {
  status: "done",
  vin: "9BGKS48U0LB123456",
  result: {
    info: {
      vin: "9BGKS48U0LB123456",
      wmi: "9BG",
      country: "Brasil",
      makers: [{ m: "General Motors do Brasil Chevrolet", c: "Brasil", b: ["GM - Chevrolet"] }],
      brands: ["GM - Chevrolet"],
      modelYear: 2020,
      checkDigitValid: false,
    },
    vpic: null,
    modelYear: 2020,
  },
};

function renderSearch(state: VinSearchState, applied: Parameters<typeof VinSearch>[0]["applied"] = null) {
  const onSubmit = vi.fn();
  const onClear = vi.fn();
  render(<VinSearch state={state} applied={applied} onSubmit={onSubmit} onClear={onClear} />);
  return { onSubmit, onClear };
}

describe("VinSearch", () => {
  afterEach(cleanup);

  it("submits what was typed", () => {
    const { onSubmit } = renderSearch({ status: "idle" });
    fireEvent.change(screen.getByPlaceholderText(/9BWAB45U0LT000000/), {
      target: { value: "9bg ks48u0lb123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decodificar" }));
    expect(onSubmit).toHaveBeenCalledWith("9bg ks48u0lb123456");
  });

  it("shows why a chassis is invalid", () => {
    renderSearch({ status: "error", vin: "9BG", message: "O chassi tem 17 caracteres; este tem 3." });
    expect(screen.getByText("O chassi tem 17 caracteres; este tem 3.")).toBeTruthy();
  });

  it("shows the decoded chassis, the filters applied, and clears", () => {
    const { onClear } = renderSearch(done, {
      filters: null as never,
      brands: ["GM - Chevrolet"],
      year: 2020,
      model: null,
    });
    const status = document.getElementById("vin-search-status")!.textContent!;
    expect(status).toContain("General Motors do Brasil Chevrolet");
    expect(status).toContain("Brasil");
    expect(status).toContain("2020");
    expect(status).toContain("A NHTSA (EUA) não tem o modelo deste chassi");
    expect(status).toContain("Este fabricante não tem marca no catálogo");

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca pelo chassi" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("lists the filters it applied", () => {
    renderSearch(done, {
      filters: {} as never,
      brands: ["GM - Chevrolet"],
      year: 2020,
      model: null,
    });
    expect(screen.getByText("Filtros aplicados: GM - Chevrolet · ano 2020.")).toBeTruthy();
  });
});
