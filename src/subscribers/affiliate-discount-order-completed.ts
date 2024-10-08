import { 
  type SubscriberConfig, 
  type SubscriberArgs,
  OrderService,
} from "@medusajs/medusa"
import AffiliateDiscountService, { AdjustmentItemType } from "../services/affiliateDiscount";

export default async function affiliateDiscountOrderHandler({ 
  data, eventName, container, pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  if (pluginOptions['updateWhen'] && pluginOptions['updateWhen'] == 'PAYMENT_CAPTURED') {
    if (eventName && eventName !== OrderService.Events.PAYMENT_CAPTURED) {
        return;
      }
  } else {
    if (eventName && eventName !== OrderService.Events.COMPLETED) {
      return; 
    }
  }

  const orderService: OrderService = container.resolve('orderService');
  const order = await orderService.retrieve(data.id, {
    select: ["id", "discounts", "items"],
    relations: ["discounts", "items.adjustments"]
  });

  const adjustmentItems: AdjustmentItemType[] = order.items.flatMap(item => {
    let results: AdjustmentItemType[] = [];

    // Calculate the total adjustments for the item
    const totalAdjustments = item.adjustments.reduce((acc, adjustment) => acc + adjustment.amount, 0);
    
    // Calculate the final unit price after discounts (net price)
    const netUnitPrice = item.unit_price - totalAdjustments / item.quantity;

    item.adjustments.forEach(adjustment => {
      results.push({
        unitPrice: netUnitPrice * item.quantity, // Use the adjusted net price
        discountId: adjustment.discount_id
      })
    });
    return results;
  });

  const affiliateDiscountService: AffiliateDiscountService = container.resolve('affiliateDiscountService');

  await affiliateDiscountService.incrementUsageCountAndEarnings(adjustmentItems);
}

export const config: SubscriberConfig = {
  event: [
    OrderService.Events.PAYMENT_CAPTURED,
    OrderService.Events.COMPLETED
  ],
  context: {
    subscriberId: "affiliate-discount-order-handler",
  },
}
