import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';

export interface InventoryItem {
  id: string;
  farmer_id: string;
  item_name: string;
  item_type: string | null;
  quantity: number | null;
  unit: string | null;
  low_stock_at: number | null;
  purchase_date: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  low_stock: boolean;
  expired: boolean;
  expiring_soon: boolean;
}

const ITEM_SELECT = `
  id, farmer_id, item_name, item_type, quantity, unit, low_stock_at,
  to_char(purchase_date,'YYYY-MM-DD') AS purchase_date,
  to_char(expiry_date,'YYYY-MM-DD')   AS expiry_date,
  created_at, updated_at,
  (low_stock_at IS NOT NULL AND quantity IS NOT NULL AND quantity <= low_stock_at) AS low_stock,
  (expiry_date IS NOT NULL AND expiry_date < current_date) AS expired,
  (expiry_date IS NOT NULL AND expiry_date >= current_date
     AND expiry_date <= current_date + 30) AS expiring_soon
`;

export interface ItemInput {
  itemName: string;
  itemType?: 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'other';
  quantity?: number;
  unit?: string;
  lowStockAt?: number;
  purchaseDate?: string;
  expiryDate?: string;
}

export async function addItem(farmerId: string, input: ItemInput): Promise<InventoryItem> {
  const [row] = await query<InventoryItem>(
    `INSERT INTO inventory_items
       (farmer_id, item_name, item_type, quantity, unit, low_stock_at, purchase_date, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${ITEM_SELECT}`,
    [
      farmerId,
      input.itemName,
      input.itemType ?? null,
      input.quantity ?? null,
      input.unit ?? null,
      input.lowStockAt ?? null,
      input.purchaseDate ?? null,
      input.expiryDate ?? null,
    ],
  );
  return row!;
}

export interface ListFilter {
  itemType?: string;
  lowStockOnly?: boolean;
}

export async function listItems(farmerId: string, filter: ListFilter = {}): Promise<InventoryItem[]> {
  const params: unknown[] = [farmerId];
  const where = ['farmer_id = $1'];
  if (filter.itemType) {
    params.push(filter.itemType);
    where.push(`item_type = $${params.length}`);
  }
  let sql = `SELECT ${ITEM_SELECT} FROM inventory_items WHERE ${where.join(' AND ')}`;
  if (filter.lowStockOnly) {
    sql = `SELECT * FROM (${sql}) x WHERE x.low_stock = true`;
  }
  sql += ` ORDER BY item_type NULLS LAST, item_name`;
  return query<InventoryItem>(sql, params);
}

async function getOwnedItem(id: string, farmerId: string): Promise<InventoryItem> {
  const row = await queryMaybe<InventoryItem>(
    `SELECT ${ITEM_SELECT} FROM inventory_items WHERE id = $1`,
    [id],
  );
  if (!row) throw AppError.notFound('Item not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('Not your item');
  return row;
}

export async function getItem(id: string, farmerId: string): Promise<InventoryItem> {
  return getOwnedItem(id, farmerId);
}

export async function updateItem(
  id: string,
  farmerId: string,
  patch: Partial<ItemInput> & { quantityDelta?: number },
): Promise<InventoryItem> {
  await getOwnedItem(id, farmerId);
  const [row] = await query<InventoryItem>(
    `UPDATE inventory_items SET
       item_name = COALESCE($2, item_name),
       item_type = COALESCE($3, item_type),
       quantity = CASE
         WHEN $9::numeric IS NOT NULL THEN COALESCE(quantity, 0) + $9
         ELSE COALESCE($4, quantity) END,
       unit = COALESCE($5, unit),
       low_stock_at = COALESCE($6, low_stock_at),
       purchase_date = COALESCE($7::date, purchase_date),
       expiry_date = COALESCE($8::date, expiry_date),
       updated_at = now()
     WHERE id = $1
     RETURNING ${ITEM_SELECT}`,
    [
      id,
      patch.itemName ?? null,
      patch.itemType ?? null,
      patch.quantity ?? null,
      patch.unit ?? null,
      patch.lowStockAt ?? null,
      patch.purchaseDate ?? null,
      patch.expiryDate ?? null,
      patch.quantityDelta ?? null,
    ],
  );
  return row!;
}

export async function deleteItem(id: string, farmerId: string): Promise<void> {
  await getOwnedItem(id, farmerId);
  await query(`DELETE FROM inventory_items WHERE id = $1`, [id]);
}
