export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  category: string;
  packSize: string;
  trendQuery: string;
  tags: string[];
  accent: string;
};

// Demo merchant prices. The server remains the only authority for checkout amounts.
export const catalog: CatalogItem[] = [
  {
    id: "nescafe-classic-100g",
    name: "Nescafe Classic Coffee",
    description: "Instant coffee powder for a quick everyday morning cup.",
    pricePaise: 39900,
    category: "Beverages",
    packSize: "100 g jar",
    trendQuery: "Nescafe coffee powder",
    tags: ["coffee", "nescafe", "beverage", "breakfast", "morning", "grocery"],
    accent: "orange",
  },
  {
    id: "gentle-face-wash-100ml",
    name: "Gentle Daily Face Wash",
    description: "A soap-free cleanser for a simple morning and evening routine.",
    pricePaise: 29900,
    category: "Skincare",
    packSize: "100 ml tube",
    trendQuery: "face wash",
    tags: ["facewash", "face", "wash", "skincare", "personal", "daily"],
    accent: "blue",
  },
  {
    id: "steel-utensil-set",
    name: "Stainless Steel Utensil Set",
    description: "Six durable kitchen tools for daily cooking and serving.",
    pricePaise: 89900,
    category: "Kitchen",
    packSize: "6-piece set",
    trendQuery: "stainless steel utensils",
    tags: ["utensil", "utensils", "kitchen", "cooking", "steel", "home"],
    accent: "violet",
  },
  {
    id: "anti-dandruff-shampoo-340ml",
    name: "Anti-Dandruff Shampoo",
    description: "Everyday scalp cleansing with a fresh, mild fragrance.",
    pricePaise: 34900,
    category: "Haircare",
    packSize: "340 ml bottle",
    trendQuery: "anti dandruff shampoo",
    tags: ["shampoo", "hair", "haircare", "dandruff", "personal", "daily"],
    accent: "lime",
  },
  {
    id: "spf50-sunscreen-50g",
    name: "SPF 50 Daily Sunscreen",
    description: "Lightweight broad-spectrum sun protection with no white cast.",
    pricePaise: 49900,
    category: "Skincare",
    packSize: "50 g tube",
    trendQuery: "sunscreen SPF 50",
    tags: ["sunscreen", "spf", "sun", "summer", "skincare", "personal", "daily"],
    accent: "pink",
  },
  {
    id: "fresh-vegetable-box",
    name: "Fresh Vegetable Box",
    description: "A rotating mix of potatoes, onions, tomatoes and seasonal greens.",
    pricePaise: 34900,
    category: "Fresh Grocery",
    packSize: "Approx. 4 kg",
    trendQuery: "fresh vegetables online",
    tags: ["vegetable", "vegetables", "grocery", "fresh", "healthy", "cooking", "kitchen"],
    accent: "lime",
  },
  {
    id: "seasonal-fruit-basket",
    name: "Seasonal Fruit Basket",
    description: "A merchant-selected mix of fresh, ready-to-eat seasonal fruit.",
    pricePaise: 44900,
    category: "Fresh Grocery",
    packSize: "Approx. 3 kg",
    trendQuery: "fresh fruits online",
    tags: ["fruit", "fruits", "grocery", "fresh", "healthy", "snack", "breakfast"],
    accent: "orange",
  },
  {
    id: "tomatoes-1kg",
    name: "Fresh Tomatoes",
    description: "Firm everyday tomatoes for curries, salads and sauces.",
    pricePaise: 6500,
    category: "Vegetables",
    packSize: "1 kg",
    trendQuery: "tomato price",
    tags: ["tomato", "tomatoes", "vegetable", "grocery", "fresh", "cooking"],
    accent: "pink",
  },
  {
    id: "bananas-dozen",
    name: "Bananas",
    description: "A naturally convenient breakfast and snack staple.",
    pricePaise: 8500,
    category: "Fruits",
    packSize: "12 pieces",
    trendQuery: "banana price",
    tags: ["banana", "bananas", "fruit", "grocery", "fresh", "healthy", "snack", "breakfast"],
    accent: "lime",
  },
  {
    id: "basmati-rice-5kg",
    name: "Everyday Basmati Rice",
    description: "Aromatic long-grain rice for regular family meals.",
    pricePaise: 69900,
    category: "Grocery Staples",
    packSize: "5 kg bag",
    trendQuery: "basmati rice",
    tags: ["rice", "basmati", "grocery", "staple", "cooking", "family", "kitchen"],
    accent: "blue",
  },
  {
    id: "laundry-detergent-1kg",
    name: "Everyday Laundry Detergent",
    description: "Machine and bucket-wash powder for regular household laundry.",
    pricePaise: 24900,
    category: "Home Care",
    packSize: "1 kg pack",
    trendQuery: "laundry detergent powder",
    tags: ["detergent", "laundry", "cleaning", "home", "household", "daily"],
    accent: "violet",
  },
];

export function findCatalogItem(id: string) {
  return catalog.find((item) => item.id === id);
}

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
