// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useView } from "./useView";

describe("useView", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("navigates with a history entry and follows back/forward", () => {
    window.history.replaceState(null, "", "/?marcaId=22");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { result } = renderHook(() => useView());
    expect(result.current.view).toBe("consulta");

    act(() => result.current.navigate("catalogo"));
    expect(result.current.view).toBe("catalogo");
    expect(window.location.search).toBe("");

    act(() => {
      window.history.replaceState(null, "", "/?marcaId=22");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.view).toBe("consulta");
  });

  it("lets modified clicks open the link in a new tab", () => {
    window.history.replaceState(null, "", "/?view=consulta");
    const { result } = renderHook(() => useView());
    const link = result.current.viewLink("catalogo");
    expect(link.href).toBe("/");
    const preventDefault = vi.fn();
    link.onClick({ ctrlKey: true, metaKey: false, shiftKey: false, button: 0, preventDefault } as never);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.view).toBe("consulta");
  });
});
