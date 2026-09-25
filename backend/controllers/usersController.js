const fs = require("fs");
const path = require("path");

const usersPath = path.join(__dirname, "..", "data", "users.json");

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

function normalizeUser(user) {
  return {
    id: Number(user.id),
    name: String(user.name || "Usuario").trim(),
    email: String(user.email || "").trim(),
    role: String(user.role || "Visualizador").trim(),
    team: String(user.team || "Sin equipo").trim(),
    area: String(user.area || "Sin área").trim(),
    phone: String(user.phone || "").trim(),
    status: String(user.status || "Activo").trim(),
  };
}

exports.list = (req, res) => {
  const users = readUsers().map(normalizeUser);
  res.json(users);
};

exports.getById = (req, res) => {
  const id = Number(req.params.id);
  const users = readUsers();
  const user = users.find((item) => Number(item.id) === id);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  res.json(normalizeUser(user));
};

exports.update = (req, res) => {
  const id = Number(req.params.id);
  const users = readUsers();
  const index = users.findIndex((item) => Number(item.id) === id);

  if (index === -1) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const current = users[index];
  const nextUser = normalizeUser({
    ...current,
    ...req.body,
    id,
  });

  users[index] = nextUser;
  writeUsers(users);
  res.json(nextUser);
};
