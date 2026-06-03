import { render, screen } from "@testing-library/react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

// next/link renders an <a> in tests
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const mockProduct: Product = {
  id: "prod-1",
  category_id: "cat-1",
  slug: "tiandy-tc-c32gn",
  name_he: "מצלמת Tiandy TC-C32GN",
  short_desc_he: "מצלמה כיפה 2MP",
  description_he: null,
  image_url: "https://example.com/cam.jpg",
  datasheet_url: null,
  specs: {},
  is_featured: false,
  sort: 0,
  sku: "TC-C32GN",
  price: 450,
  price_contractor: 400,
  currency: "ILS",
  stock: 15,
  reorder_point: 5,
  min_order_qty: 1,
  is_orderable: true,
};

describe("ProductCard", () => {
  it("renders product name", () => {
    render(<ProductCard product={mockProduct} showPrice={false} />);
    expect(screen.getByText("מצלמת Tiandy TC-C32GN")).toBeInTheDocument();
  });

  it("renders short description", () => {
    render(<ProductCard product={mockProduct} showPrice={false} />);
    expect(screen.getByText("מצלמה כיפה 2MP")).toBeInTheDocument();
  });

  it("shows price when showPrice=true", () => {
    render(<ProductCard product={mockProduct} showPrice={true} />);
    // formatPrice(450, 'ILS') should produce something with '450'
    const priceEl = screen.getByText(/450/);
    expect(priceEl).toBeInTheDocument();
  });

  it("hides price and shows dealer-only text when showPrice=false", () => {
    render(<ProductCard product={mockProduct} showPrice={false} />);
    expect(screen.getByText("מחיר לסוחרים")).toBeInTheDocument();
    expect(screen.queryByText(/450/)).not.toBeInTheDocument();
  });

  it("shows in-stock badge when showPrice=true and stock > 0", () => {
    render(<ProductCard product={mockProduct} showPrice={true} />);
    expect(screen.getByText(/במלאי/)).toBeInTheDocument();
  });

  it("shows out-of-stock badge when stock is 0", () => {
    const outOfStock: Product = { ...mockProduct, stock: 0 };
    render(<ProductCard product={outOfStock} showPrice={true} />);
    expect(screen.getByText("אזל")).toBeInTheDocument();
  });

  it("links to product page with correct slug", () => {
    render(<ProductCard product={mockProduct} showPrice={false} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/product?slug=tiandy-tc-c32gn");
  });

  it("renders product image with correct src and alt", () => {
    render(<ProductCard product={mockProduct} showPrice={false} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("cam.jpg");
    expect(img.alt).toBe("מצלמת Tiandy TC-C32GN");
  });

  it("renders placeholder image when image_url is null", () => {
    const noImage: Product = { ...mockProduct, image_url: null };
    render(<ProductCard product={noImage} showPrice={false} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("placeholder.svg");
  });
});
