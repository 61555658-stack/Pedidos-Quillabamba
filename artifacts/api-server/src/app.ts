import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { appAuthMiddleware } from "./middlewares/appAuthMiddleware";
import { AppError } from "./lib/operations-data";
import { ZodError } from "zod";
import type { ErrorRequestHandler } from "express";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(appAuthMiddleware);

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) { next(error); return; }
  if(error instanceof AppError) {res.status(error.status).json({error:error.message});return;}
  if(error instanceof ZodError) {res.status(400).json({error:"Revisa los campos: "+error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")});return;}
  if(error?.code==="23505") {res.status(409).json({error:"Ese correo, nombre o registro ya existe."});return;}
  if(error?.code==="LIMIT_FILE_SIZE") {res.status(400).json({error:"El archivo supera el tamaño permitido."});return;}
  req.log.error({err:error},"Operation failed");
  res.status(500).json({error:"No se pudo completar la acción. Intenta nuevamente."});
};
app.use(errorHandler);
export default app;
