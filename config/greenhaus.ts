export const ALLOWED_STATES = ['TN'] as const;
export type AllowedState = typeof ALLOWED_STATES[number];

export type StoreInfo = {
  id: string;
  name: string;
  city: string;
  state: AllowedState;
  lat?: number;
  lng?: number;
  onlineOrderUrl: string;
};

export const STORES: StoreInfo[] = [
  {
    id: 'greenhaus-tn-cookeville',
    name: 'GreenHaus Cannabis Co.',
    city: 'Cookeville',
    state: 'TN',
    lat: 36.1628,
    lng: -85.5016,
    onlineOrderUrl: 'https://greenhauscc.com',
  },
  {
    id: 'greenhaus-tn-crossville',
    name: 'GreenHaus Crossville',
    city: 'Crossville',
    state: 'TN',
    lat: 35.9481,
    lng: -85.0269,
    onlineOrderUrl: 'https://greenhauscc.com',
  },
];

export const Store = {
  HOME: "https://greenhauscc.com/",
  SEARCH: "https://greenhauscc.com/products",
  CART: "https://greenhauscc.com/cart",
  ORDERS: "https://greenhauscc.com/account/orders",
  PROFILE: "https://greenhauscc.com/account",
};

export const GREENHAUS = {
  domain: "greenhauscc.com",
  home: "https://greenhauscc.com/",
  search: "https://greenhauscc.com/products",
  cart: "https://greenhauscc.com/cart",
  orders: "https://greenhauscc.com/account/orders",
  profile: "https://greenhauscc.com/account",
  categories: {
    flower: "https://greenhauscc.com/products/Flower-c151502143",
    edibles: "https://greenhauscc.com/products/Edibles-c151503430",
    prerolls: "https://greenhauscc.com/products/Pre-Rolls-c180880259",
    cartridges: "https://greenhauscc.com/products/Disposables-&-Cartridges-c180876996",
    concentrates: "https://greenhauscc.com/products/Concentrates-c151501953",
    cbd: "https://greenhauscc.com/products/CBD-c151508161",
    pets: "https://greenhauscc.com/products/Pets-c172404324",
    accessories: "https://greenhauscc.com/products/Smoking-Accessories-c180879761",
  }
};

export type RouteType = "home" | "search" | "cart" | "orders" | "profile" | "other";

export function matchRoute(url: string): RouteType {
  try {
    const urlLower = url.toLowerCase();
    
    if (/\/products\/cart(\?|$|\/)/i.test(urlLower) || /\/cart(\?|$|\/)/i.test(urlLower)) {
      return "cart";
    }
    
    if (/\/account\/orders(\?|$|\/)/i.test(urlLower)) {
      return "orders";
    }
    
    if (/\/account(\?|$|\/)/i.test(urlLower) && !/\/account\/orders/i.test(urlLower)) {
      return "profile";
    }
    
    // Check if it's exactly the home page (not a product page)
    const homeUrlNormalized = GREENHAUS.home.toLowerCase().replace(/\/$/, '');
    const urlNormalized = urlLower.replace(/\/$/, '').split('?')[0];
    if (urlNormalized === homeUrlNormalized || urlNormalized === homeUrlNormalized + '/index') {
      return "home";
    }
    
    if (/\/products/i.test(urlLower)) {
      return "search";
    }
    
    return "other";
  } catch (error) {
    console.error('Error matching route:', error);
    return "other";
  }
}
