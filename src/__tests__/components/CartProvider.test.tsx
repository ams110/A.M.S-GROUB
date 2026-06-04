import { render, screen } from "@testing-library/react";
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

  it("clamps qty to stock maximum when adding repeatedly", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    for (let i = 0; i < 15; i++) {
      await user.click(screen.getByText("add-p1"));
    }
    expect(Number(screen.getByTestId("count").textContent)).toBeLessThanOrEqual(10);
  });

  it("clamps setQty above stock to stock value", async () => {
    const user = userEvent.setup();

    function HighQtyWrapper() {
      return (
        <CartProvider>
          <HighQtyDisplay />
        </CartProvider>
      );
    }
    function HighQtyDisplay() {
      const { count, add, setQty } = useCart();
      return (
        <div>
          <span data-testid="hcount">{count}</span>
          <button onClick={() => add({ product_id: "p2", slug: "cam-2", name_he: "מצ׳", price: 50, image_url: null, min_order_qty: 1, stock: 5 }, 1)}>add-p2</button>
          <button onClick={() => setQty("p2", 999)}>setQty-999</button>
        </div>
      );
    }

    render(<HighQtyWrapper />);
    await user.click(screen.getByText("add-p2"));
    await user.click(screen.getByText("setQty-999"));
    expect(Number(screen.getByTestId("hcount").textContent)).toBe(5);
  });

  it("clamps qty up to min_order_qty when qty is below minimum", async () => {
    function MinQtyWrapper() {
      return (
        <CartProvider>
          <MinQtyDisplay />
        </CartProvider>
      );
    }
    function MinQtyDisplay() {
      const { count, add } = useCart();
      return (
        <div>
          <span data-testid="mcount">{count}</span>
          <button onClick={() => add({ product_id: "p3", slug: "cam-3", name_he: "מצלמה", price: 200, image_url: null, min_order_qty: 3, stock: 20 }, 1)}>add-p3</button>
        </div>
      );
    }

    const user = userEvent.setup();
    render(<MinQtyWrapper />);
    await user.click(screen.getByText("add-p3"));
    expect(Number(screen.getByTestId("mcount").textContent)).toBe(3);
  });

  it("persists cart to localStorage and restores on mount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wrapper />);
    await user.click(screen.getByText("add-p1"));
    await user.click(screen.getByText("add-p1"));
    unmount();

    render(<Wrapper />);
    expect(Number(screen.getByTestId("count").textContent)).toBe(2);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorageMock.setItem("tiandy_cart_v1", "not-valid-json{{{");
    render(<Wrapper />);
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("throws if useCart is used outside CartProvider", () => {
    const originalError = console.error;
    console.error = jest.fn();
    expect(() => render(<CartDisplay />)).toThrow("useCart must be used within CartProvider");
    console.error = originalError;
  });
});
