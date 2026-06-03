import { render, act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "@/components/CartProvider";

// ── localStorage mock ────────────────────────────────────────────────────────
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ── helper: a component that exposes cart via text nodes ─────────────────────
function CartDisplay() {
  const { count, subtotal, lines, add, remove, setQty, clear } = useCart();
  return (
    <div>
      <span data-testid="count">{count}</span>
      <span data-testid="subtotal">{subtotal}</span>
      <span data-testid="lines">{lines.length}</span>
      <button
        onClick={() =>
          add(
            {
              product_id: "p1",
              slug: "cam-1",
              name_he: "מצלמה",
              price: 100,
              image_url: null,
              min_order_qty: 1,
              stock: 10,
            },
            1
          )
        }
      >
        add-p1
      </button>
      <button onClick={() => add({ product_id: "p1", slug: "cam-1", name_he: "מצלמה", price: 100, image_url: null, min_order_qty: 1, stock: 10 }, 2)}>
        add-p1-x2
      </button>
      <button onClick={() => setQty("p1", 5)}>setQty-5</button>
      <button onClick={() => remove("p1")}>remove-p1</button>
      <button onClick={() => clear()}>clear</button>
    </div>
  );
}

function Wrapper() {
  return (
    <CartProvider>
      <CartDisplay />
    </CartProvider>
  );
}

beforeEach(() => localStorageMock.clear());

describe("CartProvider", () => {
  it("starts empty", () => {
    render(<Wrapper />);
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("lines").textContent).toBe("0");
  });

  it("adds a product", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("subtotal").textContent).toBe("100");
  });

  it("increments qty when the same product is added again", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("add-p1"));
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("does not duplicate lines for the same product", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("add-p1"));
    expect(screen.getByTestId("lines").textContent).toBe("1");
  });

  it("setQty updates the quantity", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("setQty-5"));
    expect(screen.getByTestId("count").textContent).toBe("5");
    expect(screen.getByTestId("subtotal").textContent).toBe("500");
  });

  it("remove deletes the product line", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("remove-p1"));
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("lines").textContent).toBe("0");
  });

  it("clear empties the cart", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("add-p1-x2"));
    await user.click(screen.getByText("clear"));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("clamps qty to stock maximum", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    // stock is 10, try to set qty to 99 — should clamp to 10
    await act(async () => {
      // use setQty to 99 — but our button sets to 5, so let's just verify clamp works
      // via the add-x2 multiple times reaching stock limit
    });
    // simple: count should never exceed stock (10)
    for (let i = 0; i < 15; i++) {
      await user.click(screen.getByText("add-p1"));
    }
    expect(Number(screen.getByTestId("count").textContent)).toBeLessThanOrEqual(10);
  });

  it("throws if useCart is used outside CartProvider", () => {
    const originalError = console.error;
    console.error = jest.fn();
    expect(() => render(<CartDisplay />)).toThrow("useCart must be used within CartProvider");
    console.error = originalError;
  });
});
