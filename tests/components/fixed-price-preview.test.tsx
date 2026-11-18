import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FixedPricePreview } from "@/components/crm/FixedPricePreview";

describe("FixedPricePreview", () => {
  it("muestra el precio de venta y la utilidad en cuanto hay un costo", () => {
    render(<FixedPricePreview costInput="100" isDark={false} />);
    expect(screen.getByText(/no se puede editar/i)).toBeTruthy();
    expect(screen.getByText(/\$120\.00/)).toBeTruthy();
    expect(screen.getByText(/\$20\.00/)).toBeTruthy();
  });

  it("no inventa un precio si el costo está vacío", () => {
    render(<FixedPricePreview costInput="" isDark />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});