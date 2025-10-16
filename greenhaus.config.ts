export const GREENHAUS = {
  name: "GreenHaus",
  baseUrl: "https://greenhauscc.com",
  routes: {
    home: "/products",
    search: "/search?q=",
    cart: "/cart",
    checkout: "/checkout",
    account: "/account",
    orders: "/account/orders",
    login: "/account/login",

    categories: {
      flower: "/products/Flower-c151502143",
      edibles: "/products/Edibles-c151503430",
      preRolls: "/products/Pre-Rolls-c180880259",
      concentrates: "/products/Concentrates-c151501953",
      cbd: "/products/CBD-c151508161",
      pets: "/products/Pets-c172404324",
      smokingAccessories: "/products/Smoking-Accessories-c180879761",
      disposablesAndCartridges: "/products/Disposables-&-Cartridges-c180876996",
      cartridges: "/products/Cartridges-c186220324",
      disposables: "/products/Disposables-c186221826",
    },

    homeSections: [
      { title: "Steals & Deals", href: "/products?tag=Deals" },
      { title: "Flower", href: "/products/Flower-c151502143" },
      { title: "Edibles", href: "/products/Edibles-c151503430" },
      { title: "Cartridges", href: "/products/Cartridges-c186220324" },
      { title: "Pre-Rolls", href: "/products/Pre-Rolls-c180880259" },
      { title: "Concentrates", href: "/products/Concentrates-c151501953" },
    ],
  },

  style: {
    brandHex: "#1E4D3A",
    injectedCSS: `
      header, nav, footer, .site-footer, .announcement-bar, .cookiebar, .cookie-banner { display:none !important; }
      .app-hide { display:none !important; }
      body { padding-bottom: 88px !important; }
      * { -webkit-overflow-scrolling: touch; }
      body { overscroll-behavior: none; }
    `,
  },

  selectors: {
    cartCount: ".header .cart-count, .cart-count, [data-cart-count]",
    searchInput: "input[type='search'], input[name='q']",
    addToCartButton: "button.add-to-cart, [data-add-to-cart]",
    productCard: ".product-card, [data-product-id]",
  },
};

export default GREENHAUS;
