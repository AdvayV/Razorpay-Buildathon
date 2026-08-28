export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  tags: string[];
  accent: string;
};

export const catalog: CatalogItem[] = [
  {
    id: "focus-tea",
    name: "Focus Tea Ritual",
    description: "Tulsi, green tea and mint for a clear morning.",
    pricePaise: 89900,
    tags: ["focus", "morning", "tea", "energy"],
    accent: "lime",
  },
  {
    id: "calm-tea",
    name: "Calm Evening Blend",
    description: "Caffeine-free chamomile and rose for winding down.",
    pricePaise: 79900,
    tags: ["calm", "evening", "sleep", "tea"],
    accent: "violet",
  },
  {
    id: "ceramic-infuser",
    name: "Ceramic Infuser Mug",
    description: "A stoneware mug with a removable steel infuser.",
    pricePaise: 49900,
    tags: ["mug", "tea", "gift", "focus", "calm"],
    accent: "orange",
  },
  {
    id: "ritual-journal",
    name: "90-Day Ritual Journal",
    description: "A minimal daily planner for habits and reflection.",
    pricePaise: 64900,
    tags: ["focus", "journal", "morning", "gift"],
    accent: "blue",
  },
  {
    id: "gift-wrap",
    name: "Botanical Gift Wrap",
    description: "Recycled paper, handwritten note and dried flowers.",
    pricePaise: 19900,
    tags: ["gift", "wrap"],
    accent: "pink",
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
