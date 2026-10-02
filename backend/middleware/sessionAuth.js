const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const database = require("../database");

const SESSION_COOKIE = "docuhenkia_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const usersPath = path.join(__dirname, "..", "data", "users.json");
const sessions = new Map();

function hashSession(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCookie(req) {
  const cookies = String(req.headers.cookie || "").split(";");
  const cookie = cookies.find((item) => item.trim().startsWith(`${SESSION_COOKIE}=`));
  return cookie ? cookie.trim().slice(SESSION_COOKIE.length + 1) : "";
}

function secureCookie(req) {
  return process.env.COOKIE_SECURE === "true" || req.secure === true;
}

exports.registerSuccessfulLogin = async (username) => {
  const normalizedUsername = String(username).trim().toLowerCase();
  let user;

  if (database.isConfigured) {
    const { rows: existing } = await database.pool.query(
      "SELECT * FROM users WHERE lower(email) = $1 OR lower(name) = $1 ORDER BY CASE WHEN lower(email) = $1 THEN 0 ELSE 1 END LIMIT 1",
      [normalizedUsername]
    );
    if (existing.length) {
      user = existing[0];
    } else {
      const { rows } = await database.pool.query(
        `INSERT INTO users (name, email, role, team, area, phone, status)
         VALUES ($1, $1, 'Visualizador', 'Sin equipo', 'Sin área', '', 'Activo')
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING *`,
        [normalizedUsername]
      );
      user = rows[0];
    }

    if (user.status !== "Activo") return { ...user, loginAllowed: false };
    const { rows } = await database.pool.query(
      "UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *",
      [user.id]
    );
    return { ...rows[0], loginAllowed: true };
  }

  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  } catch {}
  user = users.find((entry) => String(entry.email || "").trim().toLowerCase() === normalizedUsername
    || String(entry.name || "").trim().toLowerCase() === normalizedUsername);
  if (!user) {
    const id = users.reduce((maximum, entry) => Math.max(maximum, Number(entry.id) || 0), 0) + 1;
    user = {
      id,
      name: normalizedUsername,
      email: normalizedUsername,
      role: "Visualizador",
      team: "Sin equipo",
      area: "Sin área",
      phone: "",
      status: "Activo",
    };
    users.push(user);
  }
  if (user.status !== "Activo") return { ...user, loginAllowed: false };
  user.lastLoginAt = new Date().toISOString();
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  return { ...user, loginAllowed: true };
};

exports.createSession = async (res, req, user) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const username = String(user.email || user.name).trim();
  if (database.isConfigured) {
    await database.pool.query(
      `INSERT INTO user_sessions (session_id, user_id, username, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [hashSession(token), user.id, username, new Date(expiresAt).toISOString()]
    );
  }
  sessions.set(token, { username, userId: Number(user.id), expiresAt });
  const secure = secureCookie(req) ? "; Secure" : "";
  res.append("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
};

exports.destroySession = async (req, res) => {
  const token = getCookie(req);
  if (token) {
    sessions.delete(token);
    if (database.isConfigured) {
      await database.pool.query(
        "UPDATE user_sessions SET logged_out_at = NOW() WHERE session_id = $1 AND logged_out_at IS NULL",
        [hashSession(token)]
      );
    }
  }
  const secure = secureCookie(req) ? "; Secure" : "";
  res.append("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
};

async function findSessionUser(username) {
  if (database.isConfigured) {
    const { rows } = await database.pool.query(
      `SELECT * FROM users
       WHERE lower(email) = lower($1) OR lower(name) = lower($1)
       ORDER BY CASE WHEN lower(email) = lower($1) THEN 0 ELSE 1 END
       LIMIT 1`,
      [username]
    );
    return rows[0] || null;
  }

  try {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    return users.find((user) =>
      String(user.email || "").toLowerCase() === username.toLowerCase()
      || String(user.name || "").toLowerCase() === username.toLowerCase()
    ) || null;
  } catch {
    return null;
  }
}

exports.requireActiveUser = async (req, res, next) => {
  const token = getCookie(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Inicia sesión para continuar" });
  }

  try {
    const user = await findSessionUser(session.username);
    if (!user) return res.status(403).json({ error: "Tu usuario no está registrado en DOCUHENKIA" });
    if (user.status !== "Activo") {
      sessions.delete(token);
      if (database.isConfigured) {
        await database.pool.query(
          "UPDATE user_sessions SET logged_out_at = NOW() WHERE session_id = $1 AND logged_out_at IS NULL",
          [hashSession(token)]
        );
      }
      return res.status(403).json({ error: "Tu usuario está inactivo" });
    }
    if (database.isConfigured) {
      await database.pool.query(
        "UPDATE user_sessions SET last_seen_at = NOW() WHERE session_id = $1 AND logged_out_at IS NULL",
        [hashSession(token)]
      );
    }
    req.sessionUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.sessionUser?.role !== "Administrador") {
    return res.status(403).json({ error: "Solo un administrador puede gestionar usuarios" });
  }
  next();
};

exports.authorizeUserUpdate = async (req, res, next) => {
  if (req.sessionUser?.role === "Administrador") {
    const isOwnAccount = Number(req.params.id) === Number(req.sessionUser.id);
    const changesOwnLogin = isOwnAccount
      && req.body?.email
      && String(req.body.email).trim().toLowerCase() !== String(req.sessionUser.email).trim().toLowerCase();
    const disablesOwnAccount = isOwnAccount
      && ((req.body?.status && req.body.status !== "Activo")
        || (req.body?.role && req.body.role !== "Administrador"));
    if (changesOwnLogin) {
      return res.status(409).json({ error: "No puedes cambiar el usuario de acceso de la sesión actual" });
    }
    if (disablesOwnAccount) {
      return res.status(409).json({ error: "No puedes desactivar ni quitar el rol de tu propia cuenta" });
    }
    return next();
  }

  try {
    const targetId = Number(req.params.id);
    const currentId = Number(req.sessionUser?.id);
    if (Number.isFinite(targetId) && targetId === currentId) {
      req.profileOnly = true;
      return next();
    }
    return res.status(403).json({ error: "No tienes permiso para modificar este usuario" });
  } catch (error) {
    return next(error);
  }
};