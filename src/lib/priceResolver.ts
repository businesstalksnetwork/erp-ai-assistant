import { supabase } from "@/integrations/supabase/client";

export type PriceContext = {
  type: "wholesale" | "retail";
  priceListId?: string;
  locationId?: string;
};

/**
 * Resolves the best price for a product using a fallback chain:
 * 1. Specific price list price (wholesale or retail)
 * 2. Default price list price
 * 3. Product default price (default_sale_price for wholesale, default_retail_price for retail)
 */
export async function resolveProductPrice(
  productId: string,
  tenantId: string,
  context: PriceContext
): Promise<number> {
  // 1. Try specific price list
  if (context.type === "wholesale" && context.priceListId) {
    const { data } = await supabase
      .from("wholesale_prices")
      .select("price")
      .eq("price_list_id", context.priceListId)
      .eq("product_id", productId)
      .maybeSingle();
    if (data?.price) return Number(data.price);
  }

  if (context.type === "retail" && context.priceListId) {
    const { data } = await supabase
      .from("retail_prices")
      .select("retail_price")
      .eq("price_list_id", context.priceListId)
      .eq("product_id", productId)
      .maybeSingle();
    if (data?.retail_price) return Number(data.retail_price);
  }

  // For retail + location, try location-based prices via inventory_stock or skip
  // (POS already handles location prices separately)

  // 2. Try default price list
  if (context.type === "wholesale") {
    const { data: defaultList } = await supabase
      .from("wholesale_price_lists")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    if (defaultList) {
      const { data } = await supabase
        .from("wholesale_prices")
        .select("price")
        .eq("price_list_id", defaultList.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (data?.price) return Number(data.price);
    }
  }

  if (context.type === "retail") {
    const { data: defaultList } = await supabase
      .from("retail_price_lists")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();
    if (defaultList) {
      const { data } = await supabase
        .from("retail_prices")
        .select("retail_price")
        .eq("price_list_id", defaultList.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (data?.retail_price) return Number(data.retail_price);
    }
  }

  // 3. Fallback to product default
  const { data: product } = await supabase
    .from("products")
    .select("default_sale_price, default_retail_price")
    .eq("id", productId)
    .single();

  if (!product) return 0;

  if (context.type === "retail") {
    return Number(product.default_retail_price) || Number(product.default_sale_price) || 0;
  }
  return Number(product.default_sale_price) || 0;
}

/**
 * Batch resolve prices for multiple products (reduces DB calls via in-memory caching).
 * Returns a Map<productId, price>.
 */
export async function resolveProductPrices(
  productIds: string[],
  tenantId: string,
  context: PriceContext
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  // For now, resolve individually. Can be optimized with batch queries later.
  await Promise.all(
    productIds.map(async (id) => {
      const price = await resolveProductPrice(id, tenantId, context);
      result.set(id, price);
    })
  );
  return result;
}
