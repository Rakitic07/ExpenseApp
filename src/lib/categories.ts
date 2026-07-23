export type CategoryDef = {
  name: string;
  color: string;
  emoji: string;
};

// Category palette inspired by the source sheet. Colors are used across
// charts and pills so a category always looks the same everywhere.
export const CATEGORIES: CategoryDef[] = [
  { name: "Grocery", color: "#ff6b6b", emoji: "🥦" },
  { name: "Meat/Fish", color: "#ff8fab", emoji: "🍗" },
  { name: "Petrol", color: "#845ef7", emoji: "⛽" },
  { name: "Shopping/Home", color: "#ffa94d", emoji: "🛍️" },
  { name: "Bills", color: "#4dabf7", emoji: "🧾" },
  { name: "Beauty", color: "#f783ac", emoji: "💄" },
  { name: "Food", color: "#ffd43b", emoji: "🍽️" },
  { name: "Family", color: "#38d9a9", emoji: "👨‍👩‍👧" },
  { name: "Education", color: "#22b8cf", emoji: "📚" },
  { name: "Health", color: "#69db7c", emoji: "🩺" },
  { name: "Charity", color: "#e599f7", emoji: "🤝" },
  { name: "Gift", color: "#ffc078", emoji: "🎁" },
  { name: "Travel", color: "#66d9e8", emoji: "✈️" },
  { name: "Investments", color: "#4263eb", emoji: "📈" },
  { name: "Stocks", color: "#0ca678", emoji: "📊" },
  { name: "Mutual Funds", color: "#7048e8", emoji: "💹" },
  { name: "SIP", color: "#f76707", emoji: "🔁" },
  { name: "Insurance", color: "#1098ad", emoji: "🛡️" },
  { name: "Crypto", color: "#f59f00", emoji: "🪙" },
  { name: "Maid", color: "#ffa8a8", emoji: "🧹" },
  { name: "Worship", color: "#b197fc", emoji: "🙏" },
  { name: "Apartment", color: "#74c0fc", emoji: "🏢" },
  { name: "Donation", color: "#f06595", emoji: "💝" },
  { name: "Other", color: "#adb5bd", emoji: "✨" },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

const fallback: CategoryDef = { name: "Other", color: "#adb5bd", emoji: "✨" };

export function categoryColor(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.color ?? fallback.color;
}

export function categoryMeta(name: string): CategoryDef {
  return CATEGORIES.find((c) => c.name === name) ?? { ...fallback, name };
}
