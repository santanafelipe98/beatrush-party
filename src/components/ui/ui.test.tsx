// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";
import { Avatar, Button, ProgressBar, ShapeIcon, TimerPill, formatClock } from "./index";

afterEach(cleanup);

describe("ui", () => {
  it("cn descarta valores falsos", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
  it("formatClock", () => {
    expect(formatClock(8)).toBe("0:08");
    expect(formatClock(61.2)).toBe("1:02");
    expect(formatClock(-3)).toBe("0:00");
  });
  it("TimerPill expõe role=timer", () => {
    render(<TimerPill seconds={14} />);
    expect(screen.getByRole("timer").textContent).toBe("0:14");
  });
  it("ProgressBar limita o valor entre 0 e 100", () => {
    render(<ProgressBar value={250} label="tempo" />);
    expect(screen.getByRole("progressbar", { name: "tempo" }).getAttribute("aria-valuenow")).toBe("100");
  });
  it("ShapeIcon tem rótulo acessível", () => {
    render(<ShapeIcon index={2} />);
    expect(screen.getByRole("img", { name: "círculo" })).toBeTruthy();
  });
  it("Avatar mostra a inicial em maiúscula", () => {
    render(<Avatar name="ana" avatar={1} />);
    expect(screen.getByText("A")).toBeTruthy();
  });
  it("Button respeita disabled", () => {
    render(<Button disabled>Ir</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
