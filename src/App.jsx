import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { isSupabaseConfigured, supabase } from "./supabase";

const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

const PRODUCT_PAGE_SIZE = 12;
const SUPABASE_PAGE_SIZE = 1000;

const EMPTY_PRODUCT_FORM = {
  name: "",
  category: "Living Room",
  price: "",
  imageFile: null,
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
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value);

const getRatingStars = (rating) =>
  Array.from({ length: 5 }, (_, index) =>
    index < Math.round(rating) ? "★" : "☆",
  ).join("");

const formatFeedbackDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const isFeedbackColumnError = (error) =>
  ["feedback", "reviewer_name"].some((column) =>
    error?.message?.toLowerCase().includes(column),
  );

const fetchSupabaseRows = async (
  tableName,
  columns,
  { orderBy, ascending = true } = {},
) => {
  const allRows = [];
  let start = 0;

  while (true) {
    let query = supabase.from(tableName).select(columns);

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query.range(
      start,
      start + SUPABASE_PAGE_SIZE - 1,
    );

    if (error) {
      return { data: null, error };
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < SUPABASE_PAGE_SIZE) {
      return { data: allRows, error: null };
    }

    start += SUPABASE_PAGE_SIZE;
  }
};

const applyRatingAverages = (productList, ratingRows) => {
  const ratingTotals = ratingRows.reduce((totals, row) => {
    const productRatings = totals[row.product_id] || { total: 0, count: 0 };
    productRatings.total += row.rating;
    productRatings.count += 1;
    totals[row.product_id] = productRatings;
    return totals;
  }, {});

  return productList.map((product) => {
    const productRatings = ratingTotals[product.id];

    return {
      ...product,
      rating: productRatings
        ? Number((productRatings.total / productRatings.count).toFixed(1))
        : product.rating,
      ratingCount: productRatings?.count || 0,
    };
  });
};

const getFeedbackRows = (ratingRows, productList) =>
  ratingRows
    .filter((row) => row.feedback?.trim())
    .map((row) => ({
      ...row,
      productName:
        productList.find((product) => product.id === row.product_id)?.name ||
        "Product",
    }))
    .sort((firstRow, secondRow) =>
      secondRow.created_at.localeCompare(firstRow.created_at),
    );

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

const getPageFromPath = () => {
  if (typeof window === "undefined") {
    return "home";
  }

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/cart" || path === "/admin" ? path.slice(1) : "home";
};

function App() {
  const [products, setProducts] = useState([]);
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
  const [currentPage, setCurrentPage] = useState(getPageFromPath);
  const [userRatings, setUserRatings] = useState({});
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [ratingSubmitting, setRatingSubmitting] = useState(null);
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingModalProduct, setRatingModalProduct] = useState(null);
  const [ratingModalValue, setRatingModalValue] = useState(0);
  const [ratingModalReviewerName, setRatingModalReviewerName] = useState("");
  const [ratingModalFeedback, setRatingModalFeedback] = useState("");
  const [reviewerId] = useState(() => {
    const savedReviewerId = loadSavedState("curtain-reviewer-id", null);

    if (savedReviewerId) {
      return savedReviewerId;
    }

    const newReviewerId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `reviewer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "curtain-reviewer-id",
        JSON.stringify(newReviewerId),
      );
    }

    return newReviewerId;
  });
  const [catalogFilters, setCatalogFilters] = useState({
    search: "",
    category: "All",
    sort: "featured",
  });
  const [catalogPage, setCatalogPage] = useState(1);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [imageViewerProduct, setImageViewerProduct] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);

  const openImageViewer = (product) => {
    setImageViewerProduct(product);
    setImageZoom(1);
  };

  const closeImageViewer = () => {
    setImageViewerProduct(null);
    setImageZoom(1);
  };

  const updateImageZoom = (nextZoom) => {
    const zoom = Number(nextZoom);
    setImageZoom(Math.min(3, Math.max(1, Number(zoom.toFixed(2)))));
  };

  const openRatingModal = (product) => {
    setRatingModalProduct(product);
    setRatingModalValue(userRatings[product.id] || 0);
    setRatingModalReviewerName("");
    setRatingModalFeedback("");
    setRatingMessage("");
  };

  const closeRatingModal = () => {
    setRatingModalProduct(null);
    setRatingModalValue(0);
    setRatingModalReviewerName("");
    setRatingModalFeedback("");
    setRatingMessage("");
  };

  const navigateTo = (page, hash = "") => {
    const path = page === "home" ? "/" : `/${page}`;
    window.history.pushState({}, "", `${path}${hash}`);
    setCurrentPage(page);
    setMobileNavOpen(false);

    if (hash) {
      window.requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handlePopState = () => setCurrentPage(getPageFromPath());

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const loadProducts = async () => {
      const { data, error } = await fetchSupabaseRows(
        "products",
        "id, name, category, price, rating, image_url, description",
        { orderBy: "created_at", ascending: false },
      );

      if (error) {
        console.error("Could not load products from Supabase:", error);
        return;
      }

      const productsWithImages = data.map((product) => ({
        ...product,
        image: product.image_url,
      }));

      const { data: ratingRows, error: ratingsError } = await fetchSupabaseRows(
        "product_ratings",
        "product_id, rating, reviewer_id, reviewer_name, feedback, created_at",
        { orderBy: "created_at", ascending: false },
      );

      if (ratingsError) {
        if (isFeedbackColumnError(ratingsError)) {
          const { data: legacyRatingRows, error: legacyRatingsError } =
            await fetchSupabaseRows(
              "product_ratings",
              "product_id, rating, reviewer_id, created_at",
              { orderBy: "created_at", ascending: false },
            );

          if (!legacyRatingsError) {
            const safeLegacyRows = legacyRatingRows || [];
            setProducts(
              applyRatingAverages(productsWithImages, safeLegacyRows),
            );
            setUserRatings(
              safeLegacyRows.reduce((ratings, row) => {
                if (row.reviewer_id === reviewerId) {
                  ratings[row.product_id] = row.rating;
                }
                return ratings;
              }, {}),
            );
            setFeedbackRows([]);
            return;
          }
        }

        console.warn(
          "Product ratings are unavailable. Run the product_ratings SQL setup:",
          ratingsError.message,
        );
        setProducts(productsWithImages);
        return;
      }

      const safeRatingRows = ratingRows || [];

      setProducts(applyRatingAverages(productsWithImages, safeRatingRows));
      setFeedbackRows(getFeedbackRows(safeRatingRows, productsWithImages));
      setUserRatings(
        safeRatingRows.reduce((ratings, row) => {
          if (row.reviewer_id === reviewerId) {
            ratings[row.product_id] = row.rating;
          }
          return ratings;
        }, {}),
      );
    };

    loadProducts();
  }, [reviewerId]);

  useEffect(() => {
    window.localStorage.setItem("curtain-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    window.localStorage.setItem("curtain-orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!imageViewerProduct) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setImageViewerProduct(null);
        setImageZoom(1);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imageViewerProduct]);

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
  const delivery = subtotal > 0 ? 0 : 0;
  const total = subtotal + delivery;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const catalogCategories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const searchTerm = catalogFilters.search.trim().toLowerCase();
    const visibleProducts = products.filter((product) => {
      const matchesCategory =
        catalogFilters.category === "All" ||
        product.category === catalogFilters.category;
      const matchesSearch =
        !searchTerm ||
        [product.name, product.category, product.description].some((value) =>
          String(value || "").toLowerCase().includes(searchTerm),
        );

      return matchesCategory && matchesSearch;
    });

    return [...visibleProducts].sort((firstProduct, secondProduct) => {
      if (catalogFilters.sort === "price-low") {
        return firstProduct.price - secondProduct.price;
      }

      if (catalogFilters.sort === "price-high") {
        return secondProduct.price - firstProduct.price;
      }

      if (catalogFilters.sort === "rating") {
        return secondProduct.rating - firstProduct.rating;
      }

      return 0;
    });
  }, [catalogFilters, products]);

  const catalogPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE),
  );
  const currentCatalogPage = Math.min(catalogPage, catalogPageCount);
  const catalogStartIndex = (currentCatalogPage - 1) * PRODUCT_PAGE_SIZE;
  const paginatedProducts = filteredProducts.slice(
    catalogStartIndex,
    catalogStartIndex + PRODUCT_PAGE_SIZE,
  );
  const catalogStartProduct = filteredProducts.length ? catalogStartIndex + 1 : 0;
  const catalogEndProduct = Math.min(
    catalogStartIndex + PRODUCT_PAGE_SIZE,
    filteredProducts.length,
  );
  const catalogPageNumbers = useMemo(() => {
    const firstPage = Math.max(
      1,
      Math.min(currentCatalogPage - 2, catalogPageCount - 4),
    );
    const lastPage = Math.min(catalogPageCount, firstPage + 4);

    return Array.from(
      { length: lastPage - firstPage + 1 },
      (_, index) => firstPage + index,
    );
  }, [catalogPageCount, currentCatalogPage]);

  const hasActiveFilters =
    catalogFilters.search ||
    catalogFilters.category !== "All" ||
    catalogFilters.sort !== "featured";

  const updateCatalogFilter = (name, value) => {
    setCatalogPage(1);
    setCatalogFilters((previousFilters) => ({
      ...previousFilters,
      [name]: value,
    }));
  };

  const resetCatalogFilters = () => {
    setCatalogPage(1);
    setCatalogFilters({
      search: "",
      category: "All",
      sort: "featured",
    });
  };

  const updateCatalogPage = (page) => {
    const nextPage = Math.min(catalogPageCount, Math.max(1, page));
    setCatalogPage(nextPage);
    document
      .querySelector("#collections")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRateProduct = async (
    productId,
    ratingValue,
    feedbackText,
    reviewerName,
  ) => {
    const rating = Number(ratingValue);
    const cleanFeedback = feedbackText.trim();
    const cleanReviewerName = reviewerName.trim();

    if (!rating || !isSupabaseConfigured) {
      setRatingMessage(
        "Ratings need a connected Supabase project before they can be saved.",
      );
      return false;
    }

    setRatingSubmitting(productId);
    setRatingMessage("");

    const { error: saveError } = await supabase.from("product_ratings").upsert(
      {
        product_id: productId,
        reviewer_id: reviewerId,
        reviewer_name: cleanReviewerName,
        rating,
        feedback: cleanFeedback,
      },
      { onConflict: "product_id,reviewer_id" },
    );

    if (saveError) {
      if (import.meta.env.DEV) {
        console.error("Could not save product rating:", saveError.message);
      }

      setRatingMessage("Could not save your rating. Please try again.");
      setRatingSubmitting(null);
      return false;
    }

    const { data: ratingRows, error: ratingsError } = await fetchSupabaseRows(
      "product_ratings",
      "product_id, rating, reviewer_id, reviewer_name, feedback, created_at",
      { orderBy: "created_at", ascending: false },
    );

    if (ratingsError) {
      const { data: legacyRatingRows } = await fetchSupabaseRows(
        "product_ratings",
        "product_id, rating, reviewer_id, created_at",
        { orderBy: "created_at", ascending: false },
      );

      if (legacyRatingRows) {
        setProducts((previousProducts) =>
          applyRatingAverages(previousProducts, legacyRatingRows),
        );
        if (cleanFeedback) {
          setFeedbackRows((previousRows) => [
            {
              id: `pending-${productId}-${Date.now()}`,
              product_id: productId,
              reviewer_id: reviewerId,
              reviewer_name: cleanReviewerName,
              rating,
              feedback: cleanFeedback,
              created_at: new Date().toISOString(),
              productName:
                products.find((product) => product.id === productId)?.name ||
                "Product",
            },
            ...previousRows,
          ]);
        }
        setRatingSubmitting(null);
        return true;
      }

      setRatingMessage(
        "Your rating was saved, but the average is still loading.",
      );
      setRatingSubmitting(null);
      return false;
    }

    setProducts((previousProducts) =>
      applyRatingAverages(previousProducts, ratingRows),
    );
    setFeedbackRows(() => {
      const nextProducts = applyRatingAverages(products, ratingRows);
      const nextRows = getFeedbackRows(ratingRows, nextProducts);
      const submittedFeedback = cleanFeedback;

      if (!submittedFeedback) {
        return nextRows;
      }

      const submittedRow = {
        id: `current-${productId}`,
        product_id: productId,
        reviewer_id: reviewerId,
        reviewer_name: cleanReviewerName,
        rating,
        feedback: submittedFeedback,
        created_at: new Date().toISOString(),
        productName:
          products.find((product) => product.id === productId)?.name ||
          "Product",
      };
      const withoutCurrentFeedback = nextRows.filter(
        (row) =>
          !(row.product_id === productId && row.reviewer_id === reviewerId),
      );

      return [submittedRow, ...withoutCurrentFeedback];
    });
    setUserRatings((previousRatings) => ({
      ...previousRatings,
      [productId]: rating,
    }));
    setRatingMessage("");
    setRatingSubmitting(null);
    return true;
  };

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
    navigateTo("cart");
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

  const handleProductSubmit = async (event) => {
    event.preventDefault();

    const price = Number(productForm.price);

    if (
      !productForm.name ||
      !productForm.description ||
      !productForm.imageFile ||
      !price
    ) {
      alert("Please complete all product fields before saving.");
      return;
    }

    if (!isSupabaseConfigured) {
      alert("Add your Supabase values to .env.local before uploading images.");
      return;
    }

    const file = productForm.imageFile;
    const filePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("curtain-images")
      .upload(filePath, file);

    if (uploadError) {
      alert(`Image upload failed: ${uploadError.message}`);
      return;
    }

    const { data: imageData } = supabase.storage
      .from("curtain-images")
      .getPublicUrl(filePath);

    const newProduct = {
      name: productForm.name,
      category: productForm.category,
      price,
      rating: 5.0,
      image_url: imageData.publicUrl,
      description: productForm.description,
    };

    const { data: savedProduct, error: productError } = await supabase
      .from("products")
      .insert(newProduct)
      .select("id, name, category, price, rating, image_url, description")
      .single();

    if (productError) {
      alert(`Product save failed: ${productError.message}`);
      return;
    }

    setProducts((prevProducts) => [
      { ...savedProduct, image: savedProduct.image_url },
      ...prevProducts,
    ]);
    setCatalogPage(1);
    setProductForm(EMPTY_PRODUCT_FORM);
    setCheckoutMessage("A new product has been added successfully.");
  };

  const handleCheckoutSubmit = (event) => {
    event.preventDefault();

    if (!cartItems.length) {
      alert("Your cart is empty. Add a product before checking out.");
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
    navigateTo("home");
  };

  const renderHomePage = () => (
    <main className="content-area">
      <section className="hero-section">
        <div className="hero-copy">
          <h1>Thoughtful spaces, made for living and working.</h1>
          <p>
            C.K Business Ltd brings together furniture, interior design,
            curtains, sofas, and practical office services for homes,
            workplaces, schools, and hospitals.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigateTo("home", "#services")}
            >
              Explore our services
            </button>
          </div>
        </div>
      </section>

      <section id="services" className="room-showcase">
        <div className="section-heading small">
          <span className="eyebrow">What we do</span>
          <h2>Practical expertise for better spaces</h2>
        </div>

        <div className="category-strip">
          <article className="category-card">
            <span>Furniture</span>
            <strong>Wooden and metal items for every setting</strong>
          </article>
          <article className="category-card">
            <span>Interior design</span>
            <strong>Ceilings, doors, windows, carpets and decor</strong>
          </article>
          <article className="category-card">
            <span>Curtains & sofas</span>
            <strong>Imported, tailored, supplied and installed</strong>
          </article>
          <article className="category-card">
            <span>Office services</span>
            <strong>Repairs, partitions, soundproofing and relocations</strong>
          </article>
        </div>
      </section>

      <section id="collections" className="catalog-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Featured products</span>
            <h2>products</h2>
          </div>
          <span className="section-pill">
            {filteredProducts.length > 0
              ? `Showing ${catalogStartProduct}-${catalogEndProduct} of ${filteredProducts.length}`
              : "0"}{" "}
            products
          </span>
        </div>

        <div className="catalog-toolbar" aria-label="Filter products">
          <label className="catalog-search">
            <span className="sr-only">Search products</span>
            <input
              type="search"
              placeholder="Search products"
              value={catalogFilters.search}
              onChange={(event) =>
                updateCatalogFilter("search", event.target.value)
              }
            />
          </label>

          <label className="catalog-select">
            <span className="sr-only">Filter by room</span>
            <select
              value={catalogFilters.category}
              onChange={(event) =>
                updateCatalogFilter("category", event.target.value)
              }
            >
              {catalogCategories.map((category) => (
                <option key={category} value={category}>
                  {category === "All" ? "All rooms" : category}
                </option>
              ))}
            </select>
          </label>

          <label className="catalog-select">
            <span className="sr-only">Sort products</span>
            <select
              value={catalogFilters.sort}
              onChange={(event) =>
                updateCatalogFilter("sort", event.target.value)
              }
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-low">Price: Low to high</option>
              <option value="price-high">Price: High to low</option>
              <option value="rating">Rating: Highest first</option>
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              className="clear-filters"
              onClick={resetCatalogFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {ratingMessage && <p className="rating-message">{ratingMessage}</p>}

        {filteredProducts.length > 0 ? (
          <>
            <div className="products-grid">
              {paginatedProducts.map((product) => (
              <article key={product.id} className="product-card">
                <div className="product-media">
                  <img src={product.image} alt={product.name} />
                  <span className="product-category">{product.category}</span>
                  <button
                    type="button"
                    className="product-view-btn"
                    aria-label={`View larger image of ${product.name}`}
                    onClick={() => openImageViewer(product)}
                  >
                    View
                  </button>
                </div>
                <div className="product-body">
                  <span className="rating-summary">
                    {product.ratingCount > 0
                      ? `★ ${product.rating} · ${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}`
                      : "No reviews yet"}
                  </span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-footer">
                    <strong>{formatCurrency(product.price)}</strong>
                    <div className="product-actions">
                      <button
                        type="button"
                        onClick={() => openRatingModal(product)}
                      >
                        Rate
                      </button>
                      <button type="button" onClick={() => addToCart(product)}>
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>
              </article>
              ))}
            </div>

            {catalogPageCount > 1 && (
              <nav className="catalog-pagination" aria-label="Product pages">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => updateCatalogPage(currentCatalogPage - 1)}
                  disabled={currentCatalogPage === 1}
                >
                  Previous
                </button>
                <div className="pagination-pages">
                  {catalogPageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={
                        page === currentCatalogPage
                          ? "pagination-page active"
                          : "pagination-page"
                      }
                      aria-current={page === currentCatalogPage ? "page" : undefined}
                      onClick={() => updateCatalogPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => updateCatalogPage(currentCatalogPage + 1)}
                  disabled={currentCatalogPage === catalogPageCount}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="catalog-empty-state">
            <strong>No products found</strong>
            <p>
              Try another search or reset the filters to view the collection.
            </p>
            <button
              type="button"
              className="secondary-btn"
              onClick={resetCatalogFilters}
            >
              View all products
            </button>
          </div>
        )}
      </section>

      <section id="reviews" className="reviews-section rating-section">
        <div className="section-heading small">
          <span className="eyebrow">Customer ratings</span>
          <h2>Spaces shaped by real customer feedback</h2>
        </div>

        {feedbackRows.length > 0 && (
          <div className="feedback-grid">
            {feedbackRows.slice(0, 6).map((feedback) => (
              <article className="feedback-card" key={feedback.id}>
                <div className="feedback-card-topline">
                  <span>{getRatingStars(feedback.rating)}</span>
                  <time dateTime={feedback.created_at}>
                    {formatFeedbackDate(feedback.created_at)}
                  </time>
                </div>
                <p>“{feedback.feedback}”</p>
                <strong>
                  {feedback.reviewer_name || "Verified customer"} ·{" "}
                  {feedback.productName}
                </strong>
              </article>
            ))}
          </div>
        )}
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
          onClick={() => navigateTo("home", "#collections")}
        >
          Continue shopping
        </button>
      </div>

      {cartItems.length === 0 ? (
        <div className="empty-state-box">
          <h3>Your cart is empty</h3>
          <p>Add a few products to begin your order.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigateTo("home", "#collections")}
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
              <h3>Add a product</h3>
              <input
                type="text"
                placeholder="Product name"
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
                <option>office chair</option>
                <option>office table</option>
                <option>curtain</option>
                <option>Non-office</option>
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
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    imageFile: event.target.files[0] || null,
                  })
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
                Save product
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
        <div className="topbar-start">
          <div className="brand-block">
            <div className="brand-logo">C</div>
            <div>
              <p className="brand-name">C.K Business Ltd</p>
              <span className="brand-tag">Furniture & interior design</span>
            </div>
          </div>

          <button
            type="button"
            className="mobile-nav-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="main-navigation"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav
          id="main-navigation"
          className={`main-nav${mobileNavOpen ? " open" : ""}`}
          aria-label="Main navigation"
        >
          <button
            type="button"
            className={currentPage === "home" ? "nav-link active" : "nav-link"}
            onClick={() => navigateTo("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={currentPage === "cart" ? "nav-link active" : "nav-link"}
            onClick={() => navigateTo("cart")}
          >
            Cart {cartCount > 0 ? `(${cartCount})` : ""}
          </button>
          <button
            type="button"
            className={currentPage === "admin" ? "nav-link active" : "nav-link"}
            onClick={() => navigateTo("admin")}
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

      {imageViewerProduct && (
        <div
          className="image-viewer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeImageViewer();
            }
          }}
        >
          <div
            className="image-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-viewer-title"
          >
            <div className="image-viewer-header">
              <div>
                <span className="eyebrow">{imageViewerProduct.category}</span>
                <h2 id="image-viewer-title">{imageViewerProduct.name}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close image viewer"
                onClick={closeImageViewer}
              >
                X
              </button>
            </div>

            <div className="image-viewer-toolbar" aria-label="Image zoom controls">
              <button
                type="button"
                onClick={() => updateImageZoom(imageZoom - 0.25)}
                disabled={imageZoom <= 1}
                aria-label="Zoom out"
              >
                -
              </button>
              <span>{Math.round(imageZoom * 100)}%</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.25"
                value={imageZoom}
                aria-label="Zoom image"
                onChange={(event) => updateImageZoom(event.target.value)}
              />
              <button
                type="button"
                onClick={() => updateImageZoom(imageZoom + 0.25)}
                disabled={imageZoom >= 3}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="image-viewer-reset"
                onClick={() => updateImageZoom(1)}
                disabled={imageZoom === 1}
              >
                Reset
              </button>
            </div>

            <div className="image-viewer-stage">
              <div
                className="image-viewer-canvas"
                style={{ width: `${imageZoom * 100}%` }}
              >
                <img
                  src={imageViewerProduct.image}
                  alt={imageViewerProduct.name}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {ratingModalProduct && (
        <div
          className="rating-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRatingModal();
            }
          }}
        >
          <form
            className="rating-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-modal-title"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!ratingModalValue) {
                setRatingMessage("Please select a star rating before submitting.");
                return;
              }

              if (!ratingModalReviewerName.trim()) {
                setRatingMessage("Please enter your name before submitting.");
                return;
              }

              if (!ratingModalFeedback.trim()) {
                setRatingMessage("Please write a short message before submitting.");
                return;
              }

              const saved = await handleRateProduct(
                ratingModalProduct.id,
                ratingModalValue,
                ratingModalFeedback,
                ratingModalReviewerName,
              );

              if (saved) {
                closeRatingModal();
              }
            }}
          >
            <div className="rating-modal-header">
              <div>
                <span className="eyebrow">Customer feedback</span>
                <h2 id="rating-modal-title">Rate {ratingModalProduct.name}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close rating dialog"
                onClick={closeRatingModal}
              >
                ×
              </button>
            </div>

            {ratingMessage && (
              <p className="rating-modal-message">{ratingMessage}</p>
            )}

            <div className="modal-field">
              <span>Your rating</span>
              <div
                className="modal-star-rating"
                role="radiogroup"
                aria-label={`Rate ${ratingModalProduct.name}`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={
                      star <= ratingModalValue
                        ? "star-button filled"
                        : "star-button"
                    }
                    role="radio"
                    aria-checked={ratingModalValue === star}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    onClick={() => setRatingModalValue(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-field">
              <span>Your name</span>
              <input
                type="text"
                value={ratingModalReviewerName}
                placeholder="Your name"
                maxLength="80"
                onChange={(event) =>
                  setRatingModalReviewerName(event.target.value)
                }
                required
              />
            </div>

            <div className="modal-field">
              <span>Your message</span>
              <textarea
                value={ratingModalFeedback}
                placeholder="Tell us what you think about this product"
                rows="4"
                maxLength="280"
                onChange={(event) => setRatingModalFeedback(event.target.value)}
                required
              />
            </div>

            <div className="rating-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={closeRatingModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={
                  !ratingModalValue ||
                  !ratingModalReviewerName.trim() ||
                  !ratingModalFeedback.trim() ||
                  ratingSubmitting === ratingModalProduct.id
                }
              >
                {ratingSubmitting === ratingModalProduct.id
                  ? "Saving..."
                  : "Submit rating"}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-contact">
            <span className="footer-label">Visit or contact us</span>
            <h2>Let’s shape your next space</h2>
            <ul>
              <li>
                <span>Find us</span>
                <strong>KK 394 Street, Gisozi, Kigali</strong>
              </li>
              <li>
                <span>Call us</span>
                <a href="tel:+250790235869">+250790235869</a>
              </li>
              <li>
                <span>Email us</span>
                <a href="mailto:nshutifreddy555@gmail.com">
                  nshutifreddy555@gmail.com
                </a>
              </li>
              <li>
                <span>Opening hours</span>
                <strong>Open every day</strong>
                <strong>Contact us for today’s availability</strong>
              </li>
            </ul>
          </div>

          <div className="footer-links">
            <div>
              <span className="footer-label">Explore</span>
              <button type="button" onClick={() => navigateTo("home")}>
                Home
              </button>
              <a href="/#services">Our services</a>
              <a href="/#collections">gallery</a>
            </div>
            <div>
              <span className="footer-label">Customer care</span>
              <button type="button" onClick={() => navigateTo("cart")}>
                Your cart {cartCount > 0 ? `(${cartCount})` : ""}
              </button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 C.K Business Ltd. Gisozi, Kigali.</span>
          <span>Furniture · Interiors · Curtains · Office services</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
