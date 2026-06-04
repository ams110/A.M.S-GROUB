import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/Toast";

function ToastTrigger({ msg, type }: { msg: string; type?: "success" | "error" | "info" }) {
  const toast = useToast();
  return <button onClick={() => toast(msg, type)}>show</button>;
}

function Setup({ msg = "שמור", type }: { msg?: string; type?: "success" | "error" | "info" }) {
  return (
    <ToastProvider>
      <ToastTrigger msg={msg} type={type} />
    </ToastProvider>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it("shows a toast after trigger", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="הצלחה" />);
    await user.click(screen.getByText("show"));
    expect(screen.getByText("הצלחה")).toBeInTheDocument();
  });

  it("disappears after 3.5 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="אזהרה" />);
    await user.click(screen.getByText("show"));
    expect(screen.getByText("אזהרה")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(3600));
    expect(screen.queryByText("אזהרה")).not.toBeInTheDocument();
  });

  it("applies success (green) class by default", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="ok" />);
    await user.click(screen.getByText("show"));
    const toast = screen.getByText("ok");
    expect(toast.className).toContain("bg-emerald-600");
  });

  it("applies error (red) class for error type", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="שגיאה" type="error" />);
    await user.click(screen.getByText("show"));
    const toast = screen.getByText("שגיאה");
    expect(toast.className).toContain("bg-rose-600");
  });

  it("applies info (slate) class for info type", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="מידע" type="info" />);
    await user.click(screen.getByText("show"));
    const toast = screen.getByText("מידע");
    expect(toast.className).toContain("bg-slate-700");
  });

  it("stacks multiple toasts", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Setup msg="ראשון" />);
    await user.click(screen.getByText("show"));
    await user.click(screen.getByText("show"));
    const toasts = screen.getAllByText("ראשון");
    expect(toasts.length).toBe(2);
  });
});
