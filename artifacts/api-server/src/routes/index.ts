import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import registrationVerificationRouter from "./registration-verification";
import authRouter from "./auth";
import adminRouter from "./admin";
import deliveryRouter from "./delivery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ordersRouter);
router.use(adminRouter);
router.use(deliveryRouter);
router.use(registrationVerificationRouter);

export default router;
