import { renderHook, act } from "@testing-library/react";
import { reducer, useToast, toast } from "./use-toast";

type State = { toasts: any[] };

function makeToast(id: string, extra: Record<string, unknown> = {}) {
  return { id, title: "t" + id, open: true, ...extra } as any;
}

describe("use-toast reducer", () => {
  it("ADD_TOAST prepends and respects the TOAST_LIMIT of 1", () => {
    let state: State = { toasts: [] };
    state = reducer(state, { type: "ADD_TOAST", toast: makeToast("1") });
    expect(state.toasts).toHaveLength(1);
    state = reducer(state, { type: "ADD_TOAST", toast: makeToast("2") });
    // limit of 1 keeps only the newest
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe("2");
  });

  it("UPDATE_TOAST merges into the matching toast only", () => {
    const start: State = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(start, { type: "UPDATE_TOAST", toast: { id: "1", title: "updated" } });
    expect(next.toasts.find((t) => t.id === "1")!.title).toBe("updated");
    expect(next.toasts.find((t) => t.id === "2")!.title).toBe("t2");
  });

  it("DISMISS_TOAST with an id closes only that toast", () => {
    const start: State = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(start, { type: "DISMISS_TOAST", toastId: "1" });
    expect(next.toasts.find((t) => t.id === "1")!.open).toBe(false);
    expect(next.toasts.find((t) => t.id === "2")!.open).toBe(true);
  });

  it("DISMISS_TOAST without an id closes all toasts", () => {
    const start: State = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(start, { type: "DISMISS_TOAST" });
    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("REMOVE_TOAST with an id removes only that toast", () => {
    const start: State = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(start, { type: "REMOVE_TOAST", toastId: "1" });
    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("REMOVE_TOAST without an id clears all toasts", () => {
    const start: State = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(start, { type: "REMOVE_TOAST" });
    expect(next.toasts).toEqual([]);
  });
});

describe("useToast / toast", () => {
  it("adds a toast, exposes it via the hook, and can update + dismiss it", () => {
    const { result } = renderHook(() => useToast());

    let handle: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Hello" });
    });
    expect(result.current.toasts[0].title).toBe("Hello");
    expect(result.current.toasts[0].open).toBe(true);

    act(() => {
      handle!.update({ id: handle!.id, title: "Changed" } as any);
    });
    expect(result.current.toasts[0].title).toBe("Changed");

    act(() => {
      handle!.dismiss();
    });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it("closes the toast when onOpenChange(false) is invoked", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Auto" });
    });
    act(() => {
      result.current.toasts[0].onOpenChange?.(false);
    });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it("dismisses all toasts via the hook's dismiss()", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "one" });
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.toasts.every((t) => t.open === false)).toBe(true);
  });
});
