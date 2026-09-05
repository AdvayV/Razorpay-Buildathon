import "server-only";

// Demo merchant-side economics. These values never leave the negotiation API.
export const merchantEconomics: Record<string, { costPaise: number; minimumMarginBps: number }> = {
  "nescafe-classic-100g": { costPaise: 27000, minimumMarginBps: 800 },
  "gentle-face-wash-100ml": { costPaise: 18000, minimumMarginBps: 1200 },
  "spf50-sunscreen-50g": { costPaise: 25500, minimumMarginBps: 1200 },
  "basmati-rice-5kg": { costPaise: 49500, minimumMarginBps: 600 },
  "cooking-oil-1l": { costPaise: 16000, minimumMarginBps: 600 },
  "anti-dandruff-shampoo-340ml": { costPaise: 29500, minimumMarginBps: 1000 },
  "fresh-vegetable-box": { costPaise: 31500, minimumMarginBps: 500 },
  "seasonal-fruit-basket": { costPaise: 38000, minimumMarginBps: 500 },
  "tomatoes-1kg": { costPaise: 3900, minimumMarginBps: 500 },
  "bananas-dozen": { costPaise: 5000, minimumMarginBps: 500 },
  "laundry-detergent-1kg": { costPaise: 14500, minimumMarginBps: 700 },
  "steel-utensil-set": { costPaise: 57000, minimumMarginBps: 1000 },
};
