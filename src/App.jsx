import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Luxury Beige Textured Drapes",
    category: "Living Room",
    price: 119.99,
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description:
      "Warm beige drapes with a soft woven texture for light-filtering elegance.",
  },
  {
    id: 2,
    name: "Modern Grey Blackout Curtains",
    category: "Bedroom",
    price: 94.99,
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80",
    description:
      "Thermal blackout panels that keep your room calm, dark, and cozy.",
  },
  {
    id: 3,
    name: "Classic White Sheer Curtains",
    category: "Dining Room",
    price: 69.99,
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
    description:
      "Airy sheer fabric that softens daylight while keeping a clean aesthetic.",
  },
  {
    id: 4,
    name: "Velvet Luxury Curtains",
    category: "Statement",
    price: 139.99,
    rating: 5.0,
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description:
      "Premium velvet finish for a dramatic and elegant, hotel-style look.",
  },
  {
    id: 5,
    name: "Natural Linen Blend Panels",
    category: "Minimal",
    price: 109.99,
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
    description:
      "Crafted from linen blend for a relaxed, organic, contemporary home feel.",
  },
  {
    id: 6,
    name: "Scandinavian Minimalist Curtains",
    category: "Minimal",
    price: 84.99,
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description:
      "Soft neutral tones and lightweight layering for effortlessly refined spaces.",
  },
];

const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

const EMPTY_PRODUCT_FORM = {
  name: "",
  category: "Living Room",
  price: "",
  image: "",
  description: "",
};

const EMPTY_CHECKOUT_FORM = {
  name: "",
  email: "",
  address: "",
  city: "",
  cardName: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const loadSavedState = (key, fallback) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [products, setProducts] = useState(() =>
    loadSavedState("curtain-products", DEFAULT_PRODUCTS),
  );
  const [cart, setCart] = useState(() => loadSavedState("curtain-cart", []));
  const [orders, setOrders] = useState(() =>
    loadSavedState("curtain-orders", []),
  );
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [checkoutForm, setCheckoutForm] = useState(EMPTY_CHECKOUT_FORM);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [currentPage, setCurrentPage] = useState("home");

  useEffect(() => {
    window.localStorage.setItem("curtain-products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    window.localStorage.setItem("curtain-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    window.localStorage.setItem("curtain-orders", JSON.stringify(orders));
  }, [orders]);

  const cartItems = useMemo(
    () =>
      cart
        .map((item) => {
          const product = products.find((entry) => entry.id === item.id);
          return product ? { ...product, quantity: item.quantity } : null;
        })
        .filter(Boolean),
    [cart, products],
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const delivery = subtotal > 0 ? 18 : 0;
  const total = subtotal + delivery;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);

      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...prevCart, { id: product.id, quantity: 1 }];
    });
    setCurrentPage("cart");
  };

  const updateQuantity = (productId, change) => {
    setCart((prevCart) =>
      prevCart.flatMap((item) => {
        if (item.id !== productId) {
          return [item];
        }

        const nextQuantity = item.quantity + change;
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
      }),
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const handleAdminLogin = (event) => {
    event.preventDefault();

    if (
      adminForm.username === ADMIN_CREDENTIALS.username &&
      adminForm.password === ADMIN_CREDENTIALS.password
    ) {
      setIsAdminLoggedIn(true);
      setAdminForm({ username: "", password: "" });
      return;
    }

    alert("Invalid admin credentials. Please use admin / admin123");
  };

  const handleProductSubmit = (event) => {
    event.preventDefault();

    const price = Number(productForm.price);

    if (
      !productForm.name ||
      !productForm.description ||
      !productForm.image ||
      !price
    ) {
      alert("Please complete all product fields before saving.");
      return;
    }

    const newProduct = {
      id: Date.now(),
      name: productForm.name,
      category: productForm.category,
      price,
      rating: 5.0,
      image: productForm.image,
      description: productForm.description,
    };

    setProducts((prevProducts) => [newProduct, ...prevProducts]);
    setProductForm(EMPTY_PRODUCT_FORM);
    setCheckoutMessage("A new curtain product has been added successfully.");
  };

  const handleCheckoutSubmit = (event) => {
    event.preventDefault();

    if (!cartItems.length) {
      alert("Your cart is empty. Add a curtain before checking out.");
      return;
    }

    const orderId = `CK-${Date.now()}`;

    const newOrder = {
      id: orderId,
      total,
      items: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      customer: checkoutForm.name,
      createdAt: new Date().toISOString(),
    };

    setOrders((prevOrders) => [newOrder, ...prevOrders]);
    setCart([]);
    setCheckoutForm(EMPTY_CHECKOUT_FORM);
    setCheckoutMessage(`Payment successful! Order ${orderId} has been placed.`);
    setCurrentPage("home");
  };

  const renderHomePage = () => (
    <main className="content-area">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Luxury window styling</span>
          <h1>Beautiful curtains for calm, elevated living.</h1>
          <p>
            Discover premium fabrics, blackout insulation, and designer-inspired
            styles made to create a softer and more elegant home.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => setCurrentPage("home")}
            >
              Shop collection
            </button>
            <button type="button" className="secondary-btn light">
              Book design consult
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <strong>25k+</strong>
              <span>happy homes</span>
            </div>
            <div>
              <strong>4.9/5</strong>
              <span>customer rating</span>
            </div>
            <div>
              <strong>48h</strong>
              <span>dispatch time</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <img
            src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
            alt="Luxury bedroom with curtains"
          />
        </div>
      </section>

      <section id="benefits" className="benefits-row">
        <div>
          <span>Free shipping</span>
          <strong>on orders over $150</strong>
        </div>
        <div>
          <span>Insulated</span>
          <strong>thermal & blackout</strong>
        </div>
        <div>
          <span>Easy returns</span>
          <strong>30-day guarantee</strong>
        </div>
      </section>

      <section className="room-showcase">
        <div className="section-heading small">
          <span className="eyebrow">Shop by room</span>
          <h2>Designed for every corner of your home</h2>
        </div>

        <div className="category-strip">
          <article className="category-card">
            <span>Living room</span>
            <strong>Soft layered elegance</strong>
          </article>
          <article className="category-card">
            <span>Bedroom</span>
            <strong>Night-time privacy</strong>
          </article>
          <article className="category-card">
            <span>Dining room</span>
            <strong>Light & airy styling</strong>
          </article>
          <article className="category-card">
            <span>Studio</span>
            <strong>Minimal modern finish</strong>
          </article>
        </div>
      </section>

      <section id="collections" className="catalog-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Featured styles</span>
            <h2>Curated curtains for every room</h2>
          </div>
          <span className="section-pill">{products.length} products</span>
        </div>

        <div className="products-grid">
          {products.map((product) => (
            <article key={product.id} className="product-card">
              <img src={product.image} alt={product.name} />
              <div className="product-body">
                <div className="product-topline">
                  <span>{product.category}</span>
                  <span>★ {product.rating}</span>
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-footer">
                  <strong>{formatCurrency(product.price)}</strong>
                  <button type="button" onClick={() => addToCart(product)}>
                    Add to cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="reviews" className="reviews-section">
        <div className="section-heading small">
          <span className="eyebrow">Customer love</span>
          <h2>Homes people are proudly styling</h2>
        </div>

        <div className="review-grid">
          <article className="review-card">
            <p>
              “The quality feels premium and the blackout lining works
              perfectly. My bedroom feels calmer and more luxurious.”
            </p>
            <div>
              <strong>Amelia K.</strong>
              <span>Verified buyer</span>
            </div>
          </article>
          <article className="review-card">
            <p>
              “Delivery was quick, the design looks custom-made, and the fabric
              is beautifully textured.”
            </p>
            <div>
              <strong>Daniel R.</strong>
              <span>Verified buyer</span>
            </div>
          </article>
          <article className="review-card">
            <p>
              “Very easy to style and the room instantly feels elevated. I would
              absolutely order again.”
            </p>
            <div>
              <strong>Sophia M.</strong>
              <span>Verified buyer</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  );

  const renderCartPage = () => (
    <main className="standalone-page cart-page">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Your bag</span>
          <h2>Shopping cart</h2>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setCurrentPage("home")}
        >
          Continue shopping
        </button>
      </div>

      {cartItems.length === 0 ? (
        <div className="empty-state-box">
          <h3>Your cart is empty</h3>
          <p>Add a few curtains to begin your order.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => setCurrentPage("home")}
          >
            Browse products
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item-card">
                <img src={item.image} alt={item.name} />
                <div className="cart-item-details">
                  <h3>{item.name}</h3>
                  <p>{item.category}</p>
                  <div className="cart-item-meta">
                    <strong>{formatCurrency(item.price)}</strong>
                    <div className="qty-controls">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="checkout-panel">
            <h3>Shipping & payment</h3>
            <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
              <div className="field-group">
                <input
                  type="text"
                  placeholder="Full name"
                  value={checkoutForm.name}
                  onChange={(event) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      name: event.target.value,
                    })
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={checkoutForm.email}
                  onChange={(event) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      email: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <input
                type="text"
                placeholder="Shipping address"
                value={checkoutForm.address}
                onChange={(event) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    address: event.target.value,
                  })
                }
                required
              />

              <input
                type="text"
                placeholder="City"
                value={checkoutForm.city}
                onChange={(event) =>
                  setCheckoutForm({ ...checkoutForm, city: event.target.value })
                }
                required
              />

              <input
                type="text"
                placeholder="Name on card"
                value={checkoutForm.cardName}
                onChange={(event) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    cardName: event.target.value,
                  })
                }
                required
              />

              <input
                type="text"
                inputMode="numeric"
                placeholder="Card number"
                value={checkoutForm.cardNumber}
                onChange={(event) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    cardNumber: event.target.value,
                  })
                }
                required
              />

              <div className="field-group">
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={checkoutForm.expiry}
                  onChange={(event) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      expiry: event.target.value,
                    })
                  }
                  required
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="CVV"
                  value={checkoutForm.cvv}
                  onChange={(event) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      cvv: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <strong>{formatCurrency(delivery)}</strong>
                </div>
                <div className="total-row">
                  <span>Total</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
              </div>

              <button type="submit" className="pay-btn">
                Pay {formatCurrency(total)}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );

  const renderAdminPage = () => (
    <main className="standalone-page admin-page">
      {!isAdminLoggedIn ? (
        <div className="admin-login-view">
          <div className="admin-login-card">
            <span className="eyebrow">Secure access</span>
            <h2>Admin portal</h2>
            <form className="admin-login" onSubmit={handleAdminLogin}>
              <input
                type="text"
                placeholder="Username"
                value={adminForm.username}
                onChange={(event) =>
                  setAdminForm({ ...adminForm, username: event.target.value })
                }
              />
              <input
                type="password"
                placeholder="Password"
                value={adminForm.password}
                onChange={(event) =>
                  setAdminForm({ ...adminForm, password: event.target.value })
                }
              />
              <button type="submit" className="primary-btn">
                Login
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="admin-dashboard">
          <div className="page-header-row">
            <div>
              <span className="eyebrow">Panel</span>
              <h2>Product management</h2>
            </div>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setIsAdminLoggedIn(false)}
            >
              Logout
            </button>
          </div>

          <div className="admin-grid">
            <form className="product-form" onSubmit={handleProductSubmit}>
              <h3>Add a curtain</h3>
              <input
                type="text"
                placeholder="Curtain name"
                value={productForm.name}
                onChange={(event) =>
                  setProductForm({ ...productForm, name: event.target.value })
                }
                required
              />
              <select
                value={productForm.category}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    category: event.target.value,
                  })
                }
              >
                <option>Living Room</option>
                <option>Bedroom</option>
                <option>Dining Room</option>
                <option>Minimal</option>
                <option>Statement</option>
              </select>
              <input
                type="number"
                placeholder="Price"
                step="0.01"
                value={productForm.price}
                onChange={(event) =>
                  setProductForm({ ...productForm, price: event.target.value })
                }
                required
              />
              <input
                type="url"
                placeholder="Image URL"
                value={productForm.image}
                onChange={(event) =>
                  setProductForm({ ...productForm, image: event.target.value })
                }
                required
              />
              <textarea
                placeholder="Product description"
                rows="4"
                value={productForm.description}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    description: event.target.value,
                  })
                }
                required
              />
              <button type="submit" className="primary-btn">
                Save curtain
              </button>
            </form>

            <aside className="orders-panel">
              <h3>Recent orders</h3>
              {orders.length === 0 ? (
                <p className="empty-order">No orders yet.</p>
              ) : (
                orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="order-item">
                    <div>
                      <span>{order.id}</span>
                      <strong>{order.customer}</strong>
                    </div>
                    <em>{formatCurrency(order.total)}</em>
                  </div>
                ))
              )}
            </aside>
          </div>
        </div>
      )}
    </main>
  );

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-logo">C</div>
          <div>
            <p className="brand-name">CrapperCurtain</p>
            <span className="brand-tag">Crafted interiors</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            type="button"
            className={currentPage === "home" ? "nav-link active" : "nav-link"}
            onClick={() => setCurrentPage("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={currentPage === "cart" ? "nav-link active" : "nav-link"}
            onClick={() => setCurrentPage("cart")}
          >
            Cart {cartCount > 0 ? `(${cartCount})` : ""}
          </button>
          <button
            type="button"
            className={currentPage === "admin" ? "nav-link active" : "nav-link"}
            onClick={() => setCurrentPage("admin")}
          >
            {isAdminLoggedIn ? "Admin Panel" : "Admin Login"}
          </button>
        </nav>
      </header>

      {checkoutMessage && (
        <div className="status-banner">{checkoutMessage}</div>
      )}

      {currentPage === "home" && renderHomePage()}
      {currentPage === "cart" && renderCartPage()}
      {currentPage === "admin" && renderAdminPage()}
    </div>
  );
}

export default App;
