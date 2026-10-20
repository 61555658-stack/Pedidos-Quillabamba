import { createHash, randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  SendRegistrationCodeBody,
  SendRegistrationCodeResponse,
  ConfirmRegistrationCodeBody,
  ConfirmRegistrationCodeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const lifetimeMs = 10 * 60 * 1000;
const cooldownMs = 60 * 1000;
const maxAttempts = 5;
const hourMs = 60 * 60 * 1000;

type Challenge = {
  digest: Buffer;
  salt: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
};

// Temporary challenges are server-owned; restarting the server invalidates outstanding codes.
const challenges = new Map<string, Challenge>();
const sendHistory = new Map<string, number[]>();
const verifiedRegistrations = new Map<string, number>();

function key(email: string, role: string) {
  return `${email.trim().toLowerCase()}:${role}`;
}

export function consumeVerifiedRegistration(email: string, role: string) {
  const challengeKey = key(email, role);
  const expiresAt = verifiedRegistrations.get(challengeKey);
  verifiedRegistrations.delete(challengeKey);
  return Boolean(expiresAt && Date.now() < expiresAt);
}

function digestCode(salt: string, code: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest();
}

router.post("/auth/verification/send", async (req, res): Promise<void> => {
  const parsed = SendRegistrationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ingresa un correo y un rol válidos." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const requestedRole = parsed.data.role;
  if (requestedRole === "repartidor" && email !== (process.env.INITIAL_COURIER_EMAIL || "").trim().toLowerCase()) {
    res.status(403).json({ error: "El acceso de repartidor requiere autorización previa." });
    return;
  }
  const challengeKey = key(email, parsed.data.role);
  const now = Date.now();
  const historyKey = `${req.ip || "unknown"}:${email}`;
  const recent = (sendHistory.get(historyKey) || []).filter((time) => now - time < hourMs);
  const last = challenges.get(challengeKey);
  if ((last && now - last.sentAt < cooldownMs) || recent.length >= 5) {
    res.status(429).json({ error: "Espera un momento antes de solicitar otro código." });
    return;
  }

  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) {
    req.log.error("SENDGRID_FROM_EMAIL is not configured");
    res.status(503).json({ error: "El envío de correos aún no está disponible." });
    return;
  }
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    req.log.error("SENDGRID_API_KEY is not configured");
    res.status(503).json({ error: "El envío de correos aún no está disponible." });
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from, name: "QUILLAYAA" },
        subject: "Código de verificación de QUILLAYAA",
        content: [{
          type: "text/plain",
          value: `Tu código de verificación de QUILLAYAA es ${code}. Vence en 10 minutos. Si no solicitaste este código, ignora este correo.`,
        }],
      }),
    });
    if (!response.ok) {
      req.log.warn({ status: response.status }, "SendGrid rejected verification email");
      res.status(502).json({ error: "No pudimos enviar el código. Inténtalo más tarde." });
      return;
    }
  } catch (error) {
    req.log.error({ err: error }, "Verification email request failed");
    res.status(502).json({ error: "No pudimos enviar el código. Inténtalo más tarde." });
    return;
  }

  const salt = randomBytes(16).toString("hex");
  challenges.set(challengeKey, {
    digest: digestCode(salt, code),
    salt,
    expiresAt: now + lifetimeMs,
    sentAt: now,
    attempts: 0,
  });
  sendHistory.set(historyKey, [...recent, now]);
  res.json(SendRegistrationCodeResponse.parse({ sent: true }));
});

router.post("/auth/verification/confirm", (req, res) => {
  const parsed = ConfirmRegistrationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ingresa el código de seis dígitos." });
    return;
  }
  const challengeKey = key(parsed.data.email, parsed.data.role);
  const challenge = challenges.get(challengeKey);
  if (!challenge || Date.now() >= challenge.expiresAt) {
    challenges.delete(challengeKey);
    res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
    return;
  }
  if (challenge.attempts >= maxAttempts) {
    res.status(429).json({ error: "Demasiados intentos. Solicita un código nuevo." });
    return;
  }
  challenge.attempts++;
  if (!timingSafeEqual(challenge.digest, digestCode(challenge.salt, parsed.data.code))) {
    res.status(400).json({ error: "Código incorrecto. Revisa tu correo e inténtalo de nuevo." });
    return;
  }
  challenges.delete(challengeKey);
  verifiedRegistrations.set(challengeKey, Date.now() + lifetimeMs);
  res.json(ConfirmRegistrationCodeResponse.parse({ verified: true }));
});

export default router;