import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { fieldsRouter } from './modules/fields/fields.routes.js';
import { scansRouter } from './modules/scans/scans.routes.js';
import { riskRouter } from './modules/risk/risk.routes.js';
import { alertsRouter } from './modules/alerts/alerts.routes.js';
import { hotspotsRouter } from './modules/hotspots/hotspots.routes.js';
import { pesticidesRouter } from './modules/pesticides/pesticides.routes.js';
import { calendarRouter } from './modules/calendar/calendar.routes.js';
import { schemesRouter } from './modules/schemes/schemes.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { officialRouter } from './modules/official/official.routes.js';
import { weatherRouter } from './modules/weather/weather.routes.js';
import { homeRouter } from './modules/home/home.routes.js';
import { insightsRouter } from './modules/insights/insights.routes.js';
import {
  activitiesRouter,
  expensesRouter,
  harvestsRouter,
  tasksRouter,
} from './modules/farm/farm.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/home', homeRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/fields', fieldsRouter);
apiRouter.use('/scans', scansRouter);
apiRouter.use('/risk', riskRouter);
apiRouter.use('/weather', weatherRouter);
apiRouter.use('/alerts', alertsRouter);
apiRouter.use('/hotspots', hotspotsRouter);
apiRouter.use('/pesticides', pesticidesRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/harvests', harvestsRouter);
apiRouter.use('/schemes', schemesRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/official', officialRouter);
