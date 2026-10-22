import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import registrationVerificationRouter from "./registration-verification";
import appAuthRouter from "./app-auth";
import operationsRouter from "./operations";
import reportsRouter from "./reports";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(registrationVerificationRouter);
router.use(appAuthRouter);
router.use(operationsRouter);
router.use(reportsRouter);
router.use(filesRouter);

export default router;
