// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getFavorites, priceChange, removeFavorite, resetFavoritesStore, toggleFavorite } from "./favorites";

const pulse = { id: "21-9645:2025-5", label: "PULSE AUDACE 1.0 Turbo 200 Flex Aut. 2025", price: 100_000, reference: "outubro de 2026" };

describe("favorites", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFavoritesStore();
  });

  it("marks and unmarks a version, newest first, and keeps it for the next visit", () => {
    toggleFavorite(pulse, new Date("2026-10-01"));
    toggleFavorite({ ...pulse, id: "21-1:2020-1", label: "Uno" }, new Date("2026-10-02"));
    expect(getFavorites().map((item) => item.id)).toEqual(["21-1:2020-1", "21-9645:2025-5"]);

    resetFavoritesStore();
    expect(getFavorites()[1]).toEqual({ ...pulse, savedAt: "2026-10-01T00:00:00.000Z" });

    toggleFavorite(pulse);
    removeFavorite("21-1:2020-1");
    expect(getFavorites()).toEqual([]);
  });

  it("ignores broken storage", () => {
    localStorage.setItem("carro-na-tela:favoritos:v1", "{oops");
    expect(getFavorites()).toEqual([]);
    localStorage.setItem("carro-na-tela:favoritos:v1", JSON.stringify([{ id: 1 }, { ...pulse, savedAt: "x" }]));
    resetFavoritesStore();
    expect(getFavorites().map((item) => item.id)).toEqual([pulse.id]);
  });

  it("tells how the price moved since it was marked", () => {
    const favorite = { ...pulse, savedAt: "2026-01-01" };
    expect(priceChange(favorite, 102_500)).toEqual({ difference: 2_500, percent: 2.5 });
    expect(priceChange(favorite, null)).toBeNull();
    expect(priceChange({ ...favorite, price: null }, 102_500)).toBeNull();
  });
});
