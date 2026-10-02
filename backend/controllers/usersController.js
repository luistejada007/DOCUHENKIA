const fs = require("fs");
const path = require("path");
const database = require("../database");

const usersPath = path.join(__dirname, "..", "data", "users.json");
const uploadsDir = path.join(__dirname, "..", "uploads");

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath, "utf8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function nextUserId(users) {
  return users.reduce((highestId, user) => Math.max(highestId, Number(user.id) || 0), 0) + 1;
}

function normalizeUser(user) {
  const avatarPath = user.avatar_path || user.avatarPath || null;
  return {
    id: Number(user.id),
    name: String(user.name || "Usuario").trim(),
    email: String(user.email || "").trim(),
    role: String(user.role || "Visualizador").trim(),
    team: String(user.team || "Sin equipo").trim(),
    area: String(user.area || "Sin área").trim(),
    phone: String(user.phone || "").trim(),
    status: String(user.status || "Activo").trim(),
    avatarUrl: avatarPath ? `/api/users/${Number(user.id)}/avatar?v=${encodeURIComponent(avatarPath)}` : null,
    lastLoginAt: user.last_login_at || user.lastLoginAt || null,
  };
}

function removeAvatarFile(avatarPath) {
  if (!avatarPath) return;
  const filePath = path.join(uploadsDir, path.basename(avatarPath));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error("No se pudo eliminar la foto de perfil anterior:", error.message);
  }
}

function userFromRow(row) {
  return normalizeUser(row);
};

exports.list = async (req, res, next) => {
  try {
    if (database.isConfigured) {
      const { rows } = await database.pool.query("SELECT * FROM users ORDER BY id");
      return res.json(rows.map(userFromRow));
    }
    res.json(readUsers().map(normalizeUser));
  } catch (error) {
    next(error);
  }
};

exports.activity = async (req, res, next) => {
  if (!database.isConfigured) {
    return res.json(readUsers().map((user) => ({
      userId: Number(user.id),
      activeSessions: 0,
      lastSeenAt: null,
      lastLoginAt: user.lastLoginAt || null,
    })));
  }

  try {
    const { rows } = await database.pool.query(
      `SELECT u.id AS "userId", u.last_login_at AS "lastLoginAt",
         COUNT(s.session_id) FILTER (
           WHERE s.logged_out_at IS NULL AND s.expires_at > NOW()
             AND s.last_seen_at > NOW() - INTERVAL '45 seconds'
         )::int AS "activeSessions",
         MAX(s.last_seen_at) FILTER (
           WHERE s.logged_out_at IS NULL AND s.expires_at > NOW()
             AND s.last_seen_at > NOW() - INTERVAL '45 seconds'
         ) AS "lastSeenAt"
       FROM users u
       LEFT JOIN user_sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  const { name, email } = req.body || {};

  if (!String(name || "").trim() || !String(email || "").trim()) {
    return res.status(400).json({ error: "El nombre y el correo son obligatorios" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `INSERT INTO users (name, email, role, team, area, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [String(name).trim(), normalizedEmail, req.body.role || "Visualizador",
          req.body.team || "Sin equipo", req.body.area || "Sin área", req.body.phone || "",
          req.body.status === "Inactivo" ? "Inactivo" : "Activo"]
      );
      return res.status(201).json(userFromRow(rows[0]));
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
      }
      return next(error);
    }
  }

  const users = readUsers();
  if (users.some((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
  }

  const user = normalizeUser({
    ...req.body,
    id: nextUserId(users),
    email: normalizedEmail,
    status: req.body.status === "Inactivo" ? "Inactivo" : "Activo",
  });

  users.push(user);
  writeUsers(users);
  res.status(201).json(user);
};

exports.getById = async (req, res, next) => {
  const id = Number(req.params.id);
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query("SELECT * FROM users WHERE id = $1", [id]);
      if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json(userFromRow(rows[0]));
    } catch (error) {
      return next(error);
    }
  }

  const users = readUsers();
  const user = users.find((item) => Number(item.id) === id);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  res.json(normalizeUser(user));
};

exports.getAvatar = async (req, res, next) => {
  const id = Number(req.params.id);
  try {
    let avatarPath;
    if (database.isConfigured) {
      const { rows } = await database.pool.query("SELECT avatar_path FROM users WHERE id = $1", [id]);
      avatarPath = rows[0]?.avatar_path;
    } else {
      avatarPath = readUsers().find((user) => Number(user.id) === id)?.avatarPath;
    }

    if (!avatarPath) return res.status(404).json({ error: "El usuario no tiene foto de perfil" });
    const filePath = path.join(uploadsDir, path.basename(avatarPath));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "La foto de perfil no está disponible" });
    res.set("Cache-Control", "private, max-age=3600");
    return res.sendFile(filePath);
  } catch (error) {
    return next(error);
  }
};

exports.updateAvatar = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "Selecciona una imagen para continuar" });

  const id = Number(req.params.id);
  try {
    if (database.isConfigured) {
      const { rows: existingRows } = await database.pool.query(
        "SELECT avatar_path FROM users WHERE id = $1", [id]
      );
      if (!existingRows.length) {
        removeAvatarFile(req.file.filename);
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const previousAvatarPath = existingRows[0].avatar_path;
      const { rows } = await database.pool.query(
        "UPDATE users SET avatar_path = $2 WHERE id = $1 RETURNING *",
        [id, req.file.filename]
      );
      removeAvatarFile(previousAvatarPath);
      return res.json(userFromRow(rows[0]));
    }

    const users = readUsers();
    const index = users.findIndex((user) => Number(user.id) === id);
    if (index === -1) {
      removeAvatarFile(req.file.filename);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const previousAvatarPath = users[index].avatarPath;
    users[index].avatarPath = req.file.filename;
    writeUsers(users);
    removeAvatarFile(previousAvatarPath);
    return res.json(normalizeUser(users[index]));
  } catch (error) {
    removeAvatarFile(req.file.filename);
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  const id = Number(req.params.id);
  if (req.body?.name !== undefined && !String(req.body.name).trim()) {
    return res.status(400).json({ error: "El nombre no puede estar vacío" });
  }

  if (database.isConfigured) {
    try {
      const { rows: existing } = await database.pool.query("SELECT * FROM users WHERE id = $1", [id]);
      if (!existing.length) return res.status(404).json({ error: "Usuario no encontrado" });
      const current = userFromRow(existing[0]);
      const profileChanges = req.profileOnly
        ? {
            name: req.body.name ?? current.name,
            area: req.body.area ?? current.area,
            phone: req.body.phone ?? current.phone,
          }
        : req.body;
      const user = {
        ...current,
        ...profileChanges,
        id,
        name: String(profileChanges.name ?? current.name).trim(),
      };
      const { rows } = await database.pool.query(
        `UPDATE users SET name = $2, email = $3, role = $4, team = $5, area = $6, phone = $7, status = $8
         WHERE id = $1 RETURNING *`,
        [id, user.name, user.email, user.role, user.team, user.area, user.phone, user.status]
      );
      if (user.status !== "Activo") {
        await database.pool.query(
          "UPDATE user_sessions SET logged_out_at = NOW() WHERE user_id = $1 AND logged_out_at IS NULL",
          [id]
        );
      }
      return res.json(userFromRow(rows[0]));
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
      }
      return next(error);
    }
  }

  const users = readUsers();
  const index = users.findIndex((item) => Number(item.id) === id);

  if (index === -1) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const current = users[index];
  const profileChanges = req.profileOnly
    ? {
        name: req.body.name ?? current.name,
        area: req.body.area ?? current.area,
        phone: req.body.phone ?? current.phone,
      }
    : req.body;
  const nextUser = normalizeUser({ ...current, ...profileChanges, id });
  users[index] = { ...nextUser, avatarPath: current.avatarPath || null };
  writeUsers(users);
  res.json(nextUser);
};

exports.remove = async (req, res, next) => {
  const id = Number(req.params.id);
  if (id === Number(req.sessionUser?.id)) {
    return res.status(409).json({ error: "No puedes eliminar el usuario con el que iniciaste sesión" });
  }

  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query("SELECT id, role, status FROM users WHERE id = $1", [id]);
      if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });

      if (rows[0].role === "Administrador" && rows[0].status === "Activo") {
        const { rows: admins } = await database.pool.query(
          "SELECT COUNT(*)::int AS count FROM users WHERE role = 'Administrador' AND status = 'Activo' AND id <> $1",
          [id]
        );
        if (admins[0].count === 0) {
          return res.status(409).json({ error: "No se puede eliminar el último administrador activo" });
        }
      }

      await database.pool.query("DELETE FROM users WHERE id = $1", [id]);
      return res.json({ message: "Usuario eliminado correctamente" });
    } catch (error) {
      return next(error);
    }
  }

  const users = readUsers();
  const index = users.findIndex((user) => Number(user.id) === id);
  if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });
  users.splice(index, 1);
  writeUsers(users);
  res.json({ message: "Usuario eliminado correctamente" });
};
