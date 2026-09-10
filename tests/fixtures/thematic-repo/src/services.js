const inventory = new Map([['book', 2]]);
export const orders = [];
export function reserveStock(item) {
  const count = inventory.get(item) || 0;
  if (!count) return false;
  inventory.set(item, count - 1); return true;
}
export function releaseStock(item) { inventory.set(item, (inventory.get(item) || 0) + 1); }
export async function charge(amount) { return { accepted: amount <= 100 }; }
export function saveOrder(order) { orders.push(order); }
