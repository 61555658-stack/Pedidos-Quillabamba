import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import registrationVerificationRouter from "./registration-verification";
import appAuthRouter from "./app-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(registrationVerificationRouter);
router.use(appAuthRouter);

export default router;
