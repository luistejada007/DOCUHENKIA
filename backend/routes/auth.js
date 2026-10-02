const express = require("express");
const sessionAuth = require("../middleware/sessionAuth");

const router = express.Router();
const AUTH_API_URL = process.env.AUTH_API_URL || "https://portal-sip-lab.arus.com.co/auth-api/api/login/";
const AUTH_CSRF_TOKEN = process.env.AUTH_CSRF_TOKEN;
const AUTH_ALLOW_INSECURE_TLS = process.env.AUTH_ALLOW_INSECURE_TLS === "true";

if (AUTH_ALLOW_INSECURE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("Advertencia: AUTH_ALLOW_INSECURE_TLS=true está habilitado. Esto desactiva la verificación TLS y solo debe usarse en desarrollo local.");
}

router.post("/login", async (req, res, next) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "El usuario y la contraseña son obligatorios" });
  }

  try {
    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        ...(AUTH_CSRF_TOKEN
          ? {
              Cookie: `csrftoken=${AUTH_CSRF_TOKEN}`,
              "X-CSRFToken": AUTH_CSRF_TOKEN
            }
          : {})
      },
      body: JSON.stringify({ username, password })
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof data === "object" && data
        ? data.detail || data.message || data.error || data.title
        : data;
      return res.status(response.status).json({
        error: message || "No se pudo iniciar sesión"
      });
    }

    let user;
    try {
      user = await sessionAuth.registerSuccessfulLogin(username);
      if (!user.loginAllowed) {
        return res.status(403).json({ error: "Tu usuario está inactivo. Contacta al administrador." });
      }
      await sessionAuth.createSession(res, req, user);
    } catch (databaseError) {
      console.error("Error registrando el inicio de sesión:", databaseError.code || databaseError.message);
      return res.status(500).json({ error: "No fue posible registrar tu inicio de sesión." });
    }
    return res.status(200).json(data);
  } catch (error) {
    const errorCode = error.cause?.code || error.code;
    console.error("Error conectando con la API de autenticación:", errorCode || error.message);
    return next(new Error(
      "No fue posible conectar con el servicio de autenticación. " +
      "Verifica la URL, la conexión y el certificado TLS del servicio. " +
      (errorCode ? `Código: ${errorCode}` : "")
    ));
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await sessionAuth.destroySession(req, res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/heartbeat", sessionAuth.requireActiveUser, (req, res) => {
  res.status(204).end();
});

module.exports = router;
