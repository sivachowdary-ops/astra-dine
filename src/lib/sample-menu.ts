/**
 * A starter menu (Andhra restaurant) the owner can load in one tap and then edit, and the
 * showcase restaurant's menu. Prices are examples.
 */
export type SampleItem = {
  id: string;
  name: string;
  local?: string;
  desc: string;
  price: number;
  diet: "veg" | "egg" | "nonveg";
  spice: 0 | 1 | 2 | 3;
  category: string;
  station: string;
  tags: string[];
  variants?: { id: string; label: string; price: number }[];
  addons?: { id: string; label: string; price: number }[];
  prep: number;
  hours?: [number, number];
  serves?: number;
};

export const sampleCategories: { id: string; name: string; note?: string; hours?: [number, number] }[] = [
  { id: "tiffins", name: "Tiffins", note: "Till 11:30 am", hours: [7, 11.5] },
  { id: "starters", name: "Starters" },
  { id: "biryani", name: "Biryani" },
  { id: "meals", name: "Andhra meals", note: "12 to 4 pm", hours: [12, 16] },
  { id: "curries", name: "Curries" },
  { id: "breads", name: "Breads and rice" },
  { id: "desserts", name: "Desserts" },
  { id: "drinks", name: "Drinks" },
];

const half = (full: number) => [
  { id: "half", label: "Half", price: Math.round((full * 0.62) / 10) * 10 - 1 },
  { id: "full", label: "Full", price: full },
];

export const sampleItems: SampleItem[] = [
  // Tiffins
  { id: "idli", name: "Ghee karam idli", local: "ఇడ్లీ", desc: "Three soft idlis tossed in ghee and Guntur karam podi.", price: 89, diet: "veg", spice: 2, category: "tiffins", station: "kitchen", tags: ["bestseller"], prep: 6, hours: [7, 11.5] },
  { id: "pesarattu", name: "Pesarattu upma", local: "పెసరట్టు", desc: "Green gram crêpe folded over upma, with ginger chutney.", price: 129, diet: "veg", spice: 1, category: "tiffins", station: "kitchen", tags: ["chef"], prep: 9, hours: [7, 11.5] },
  { id: "masala-dosa", name: "Ghee roast masala dosa", local: "దోసె", desc: "Crisp ghee roast with potato masala, sambar and two chutneys.", price: 139, diet: "veg", spice: 1, category: "tiffins", station: "kitchen", tags: ["bestseller"], prep: 8, hours: [7, 11.5], addons: [{ id: "cheese", label: "Cheese", price: 40 }, { id: "podi", label: "Karam podi", price: 20 }] },
  { id: "punugulu", name: "Punugulu", local: "పునుగులు", desc: "Crunchy dosa-batter fritters, peanut chutney on the side.", price: 79, diet: "veg", spice: 1, category: "tiffins", station: "kitchen", tags: [], prep: 6, hours: [7, 11.5] },
  { id: "egg-dosa", name: "Egg dosa", desc: "Dosa with egg, onion and green chilli cooked into it.", price: 119, diet: "egg", spice: 2, category: "tiffins", station: "kitchen", tags: [], prep: 8, hours: [7, 11.5] },

  // Starters
  { id: "apollo-fish", name: "Apollo fish", desc: "Boneless fish in a tangy chilli-yoghurt toss with curry leaves.", price: 349, diet: "nonveg", spice: 3, category: "starters", station: "kitchen", tags: ["bestseller"], prep: 14 },
  { id: "chilli-chicken", name: "Chilli chicken, dry", desc: "Hakka-style, with green chillies and spring onion.", price: 299, diet: "nonveg", spice: 2, category: "starters", station: "kitchen", tags: [], prep: 12 },
  { id: "chicken-65", name: "Chicken 65", desc: "Hyderabad's red-fried classic, curry leaf and garlic.", price: 289, diet: "nonveg", spice: 2, category: "starters", station: "kitchen", tags: ["bestseller"], prep: 12 },
  { id: "kodi-vepudu", name: "Kodi vepudu", desc: "Country-style dry chicken fry with whole spices.", price: 329, diet: "nonveg", spice: 3, category: "starters", station: "kitchen", tags: ["chef"], prep: 15 },
  { id: "tandoori-chicken", name: "Tandoori chicken", desc: "Overnight-marinated, charred in the tandoor.", price: 449, diet: "nonveg", spice: 2, category: "starters", station: "tandoor", tags: [], prep: 18, variants: half(449) },
  { id: "paneer-tikka", name: "Paneer tikka", desc: "Hung-curd marinade, peppers and onion, from the tandoor.", price: 289, diet: "veg", spice: 1, category: "starters", station: "tandoor", tags: [], prep: 14 },
  { id: "gobi-65", name: "Gobi 65", desc: "Cauliflower florets fried crisp with red chilli and curry leaf.", price: 219, diet: "veg", spice: 2, category: "starters", station: "kitchen", tags: [], prep: 10 },
  { id: "mushroom-pepper", name: "Mushroom pepper fry", desc: "Button mushrooms with crushed black pepper and onions.", price: 249, diet: "veg", spice: 1, category: "starters", station: "kitchen", tags: ["new"], prep: 10 },

  // Biryani
  { id: "dum-biryani", name: "Chicken dum biryani", local: "బిర్యానీ", desc: "Hyderabadi dum, long-grain basmati, mirchi ka salan and raita.", price: 329, diet: "nonveg", spice: 2, category: "biryani", station: "kitchen", tags: ["bestseller"], prep: 10, addons: [{ id: "egg", label: "Boiled egg", price: 25 }, { id: "extra-raita", label: "Extra raita", price: 30 }] },
  { id: "fry-piece", name: "Fry piece chicken biryani", desc: "Biryani rice topped with spicy fried chicken, Vijayawada style.", price: 349, diet: "nonveg", spice: 3, category: "biryani", station: "kitchen", tags: ["chef"], prep: 12 },
  { id: "ulavacharu-biryani", name: "Ulavacharu chicken biryani", desc: "Horse-gram broth folded through, smoky and deep.", price: 369, diet: "nonveg", spice: 2, category: "biryani", station: "kitchen", tags: ["new"], prep: 12 },
  { id: "mutton-biryani", name: "Mutton dum biryani", desc: "Tender goat on the bone, slow dum.", price: 449, diet: "nonveg", spice: 2, category: "biryani", station: "kitchen", tags: [], prep: 10 },
  { id: "family-biryani", name: "Family pack chicken biryani", desc: "Serves 4. Two salans, raita and four boiled eggs.", price: 1099, diet: "nonveg", spice: 2, category: "biryani", station: "kitchen", tags: [], prep: 14, serves: 4 },
  { id: "paneer-biryani", name: "Paneer biryani", desc: "Tandoor-kissed paneer layered with saffron rice.", price: 289, diet: "veg", spice: 1, category: "biryani", station: "kitchen", tags: [], prep: 10 },

  // Meals
  { id: "veg-meals", name: "Andhra veg meals", desc: "Rice, pappu, two curries, pachadi, rasam, sambar, curd and sweet. Unlimited rice.", price: 249, diet: "veg", spice: 2, category: "meals", station: "kitchen", tags: ["bestseller"], prep: 5, hours: [12, 16] },
  { id: "nonveg-meals", name: "Andhra non-veg meals", desc: "Veg meals with chicken curry and fish fry.", price: 349, diet: "nonveg", spice: 2, category: "meals", station: "kitchen", tags: [], prep: 6, hours: [12, 16] },

  // Curries
  { id: "gongura-mutton", name: "Gongura mutton", local: "గోంగూర మటన్", desc: "Goat slow-cooked with sorrel leaves: sour, hot, the Andhra signature.", price: 429, diet: "nonveg", spice: 3, category: "curries", station: "kitchen", tags: ["chef", "bestseller"], prep: 12 },
  { id: "natu-kodi", name: "Natu kodi pulusu", local: "నాటు కోడి పులుసు", desc: "Country chicken in a tamarind and roasted-spice gravy.", price: 399, diet: "nonveg", spice: 3, category: "curries", station: "kitchen", tags: ["chef"], prep: 14 },
  { id: "chepala-pulusu", name: "Chepala pulusu", desc: "Godavari-style fish in tangy tamarind gravy.", price: 379, diet: "nonveg", spice: 3, category: "curries", station: "kitchen", tags: [], prep: 14 },
  { id: "butter-chicken", name: "Butter chicken", desc: "Tandoor chicken in a mild tomato-butter gravy.", price: 349, diet: "nonveg", spice: 0, category: "curries", station: "kitchen", tags: [], prep: 12 },
  { id: "paneer-butter", name: "Paneer butter masala", desc: "Cubes of paneer in a creamy tomato gravy.", price: 279, diet: "veg", spice: 0, category: "curries", station: "kitchen", tags: ["bestseller"], prep: 10 },
  { id: "bendakaya", name: "Bendakaya vepudu", local: "బెండకాయ వేపుడు", desc: "Okra fried crisp with peanuts and garlic.", price: 189, diet: "veg", spice: 1, category: "curries", station: "kitchen", tags: [], prep: 9 },
  { id: "dal-tadka", name: "Pappu tadka", desc: "Toor dal with tomato, garlic and red chilli tempering.", price: 179, diet: "veg", spice: 1, category: "curries", station: "kitchen", tags: [], prep: 8 },

  // Breads and rice
  { id: "butter-naan", name: "Butter naan", desc: "From the tandoor, brushed with butter.", price: 69, diet: "veg", spice: 0, category: "breads", station: "tandoor", tags: [], prep: 6 },
  { id: "garlic-naan", name: "Garlic naan", desc: "Chopped garlic and coriander.", price: 89, diet: "veg", spice: 0, category: "breads", station: "tandoor", tags: ["bestseller"], prep: 6 },
  { id: "tandoori-roti", name: "Tandoori roti", desc: "Whole wheat.", price: 39, diet: "veg", spice: 0, category: "breads", station: "tandoor", tags: [], prep: 5 },
  { id: "jeera-rice", name: "Jeera rice", desc: "Basmati with cumin and ghee.", price: 179, diet: "veg", spice: 0, category: "breads", station: "kitchen", tags: [], prep: 6 },
  { id: "curd-rice", name: "Curd rice", desc: "With pomegranate and a mustard-curry leaf tadka.", price: 149, diet: "veg", spice: 0, category: "breads", station: "kitchen", tags: [], prep: 4 },

  // Desserts
  { id: "double-ka-meetha", name: "Double ka meetha", desc: "Fried bread pudding soaked in saffron milk.", price: 149, diet: "veg", spice: 0, category: "desserts", station: "desserts", tags: ["bestseller"], prep: 4 },
  { id: "qubani", name: "Qubani ka meetha", desc: "Stewed apricots with fresh cream.", price: 169, diet: "veg", spice: 0, category: "desserts", station: "desserts", tags: [], prep: 4 },
  { id: "gulab-jamun", name: "Gulab jamun", desc: "Two, warm.", price: 99, diet: "veg", spice: 0, category: "desserts", station: "desserts", tags: [], prep: 3, addons: [{ id: "ice-cream", label: "Vanilla scoop", price: 50 }] },
  { id: "kulfi", name: "Malai kulfi", desc: "Pistachio and cardamom, on a stick.", price: 119, diet: "veg", spice: 0, category: "desserts", station: "desserts", tags: [], prep: 2 },

  // Drinks
  { id: "filter-coffee", name: "Filter coffee", desc: "Strong, in a davara and tumbler.", price: 59, diet: "veg", spice: 0, category: "drinks", station: "bar", tags: ["bestseller"], prep: 3 },
  { id: "masala-chai", name: "Masala chai", desc: "Ginger and cardamom.", price: 49, diet: "veg", spice: 0, category: "drinks", station: "bar", tags: [], prep: 3 },
  { id: "majjiga", name: "Spiced majjiga", local: "మజ్జిగ", desc: "Buttermilk with ginger, green chilli and coriander.", price: 59, diet: "veg", spice: 1, category: "drinks", station: "bar", tags: [], prep: 2 },
  { id: "lime-soda", name: "Fresh lime soda", desc: "Sweet, salted or mixed.", price: 79, diet: "veg", spice: 0, category: "drinks", station: "bar", tags: [], prep: 2, variants: [{ id: "sweet", label: "Sweet", price: 79 }, { id: "salt", label: "Salted", price: 79 }, { id: "mixed", label: "Mixed", price: 79 }] },
  { id: "mango-lassi", name: "Mango lassi", desc: "Banganapalli mango, thick.", price: 129, diet: "veg", spice: 0, category: "drinks", station: "bar", tags: [], prep: 3 },
  { id: "water", name: "Mineral water", desc: "1 litre.", price: 30, diet: "veg", spice: 0, category: "drinks", station: "bar", tags: [], prep: 1 },
];

