import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as inventory from './inventory.service.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth('farmer'));

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const idParam = z.object({ id: z.string().uuid() });
const itemType = z.enum(['seed', 'fertilizer', 'pesticide', 'equipment', 'other']);

const createSchema = z.object({
  itemName: z.string().trim().min(1).max(120),
  itemType: itemType.optional(),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  lowStockAt: z.coerce.number().min(0).optional(),
  purchaseDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
});

inventoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const item = await inventory.addItem(req.user!.sub, body);
    res.status(201).json({ item });
  }),
);

inventoryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { itemType: t, lowStock } = z
      .object({ itemType: itemType.optional(), lowStock: z.coerce.boolean().optional() })
      .parse(req.query);
    const items = await inventory.listItems(req.user!.sub, {
      itemType: t,
      lowStockOnly: lowStock === true,
    });
    res.json({ items });
  }),
);

inventoryRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ item: await inventory.getItem(id, req.user!.sub) });
  }),
);

inventoryRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const body = createSchema
      .partial()
      .extend({ quantityDelta: z.coerce.number().optional() })
      .parse(req.body);
    const item = await inventory.updateItem(id, req.user!.sub, body);
    res.json({ item });
  }),
);

inventoryRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await inventory.deleteItem(id, req.user!.sub);
    res.status(204).end();
  }),
);
