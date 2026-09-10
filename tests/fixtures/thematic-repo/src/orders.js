import { reserveStock, releaseStock, charge, saveOrder } from './services.js';
export async function checkout(order) {
  if (!reserveStock(order.item)) return { status: 409, error: 'out_of_stock' };
  const payment = await charge(order.total);
  if (!payment.accepted) {
    releaseStock(order.item);
    return { status: 402, error: 'payment_declined' };
  }
  saveOrder({ ...order, state: 'paid' });
  return { status: 201, state: 'paid' };
}
