import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import registrationVerificationRouter from "./registration-verification";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(registrationVerificationRouter);

export default router;
