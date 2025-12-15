export interface Listing {
  id: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  image: string;
  features: string[];
}

export const listings: Listing[] = [
  {
    id: "1",
    address: "1280 Sunset Plaza Dr, Los Angeles, CA",
    price: 4950000,
    beds: 4,
    baths: 5,
    sqft: 4200,
    description: "Architectural masterpiece with sweeping city views. Features infinity pool, smart home integration, and floor-to-ceiling glass walls.",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=2071&auto=format&fit=crop",
    features: ["Infinity Pool", "Wine Cellar", "Home Theater", "Smart Home"],
  },
  {
    id: "2",
    address: "9340 Monte Leon Ln, Beverly Hills, CA",
    price: 8500000,
    beds: 6,
    baths: 8,
    sqft: 7500,
    description: "Modern Mediterranean estate in a private gated community. Expansive grounds, tennis court, and guest house.",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop",
    features: ["Tennis Court", "Guest House", "Gated", "Spa"],
  },
  {
    id: "3",
    address: "22000 Pacific Coast Hwy, Malibu, CA",
    price: 12500000,
    beds: 5,
    baths: 6,
    sqft: 5000,
    description: "Oceanfront paradise with direct beach access. Contemporary design with organic materials and seamless indoor-outdoor living.",
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=2070&auto=format&fit=crop",
    features: ["Ocean Front", "Private Beach Access", "Rooftop Deck", "Minimalist Design"],
  },
];
