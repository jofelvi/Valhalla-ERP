export interface FormulaItem {
  id: string;
  composedProductId: string; // 🔗 producto tipo composed
  ingredientProductId: string; // 🔗 producto tipo simple
  quantity: number; // cuánto se usa en la fórmula
  unit: string;
}
