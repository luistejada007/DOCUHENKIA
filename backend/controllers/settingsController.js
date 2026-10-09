const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const database = require("../database");
const announcementEvents = require("../announcementEvents");

const settingsPath = path.join(__dirname, "..", "data", "appSettings.json");
const defaultSettings = { themeColor: "#146c43", announcements: [] };

function readSettingsFile() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return {
      themeColor: /^#[\da-f]{6}$/i.test(settings.themeColor) ? settings.themeColor : defaultSettings.themeColor,
      announcements: Array.isArray(settings.announcements) ? settings.announcements : [],
    };
  } catch {
    return { ...defaultSettings };
  }
}

async function getSettings() {
  if (!database.isConfigured) return readSettingsFile();
  const { rows } = await database.pool.query("SELECT value FROM app_settings WHERE key = $1", ["global"]);
  const settings = rows[0]?.value || defaultSettings;
  return {
    themeColor: /^#[\da-f]{6}$/i.test(settings.themeColor) ? settings.themeColor : defaultSettings.themeColor,
    announcements: Array.isArray(settings.announcements) ? settings.announcements : [],
  };
}

async function saveSettings(settings) {
  if (database.isConfigured) {
    await database.pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ["global", JSON.stringify(settings)]
    );
    return;
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

exports.get = async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
};

exports.events = (req, res) => {
  res.set({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  const unsubscribe = announcementEvents.subscribe(res);
  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
};

exports.updateTheme = async (req, res, next) => {
  const themeColor = String(req.body?.themeColor || "");
  if (!/^#[\da-f]{6}$/i.test(themeColor)) {
    return res.status(400).json({ error: "Selecciona un color hexadecimal válido" });
  }

  try {
    const settings = await getSettings();
    settings.themeColor = themeColor;
    await saveSettings(settings);
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.createAnnouncement = async (req, res, next) => {
  const title = String(req.body?.title || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!title || title.length > 100 || !message || message.length > 500) {
    return res.status(400).json({ error: "El título (1-100 caracteres) y el mensaje (1-500 caracteres) son obligatorios" });
  }

  try {
    const settings = await getSettings();
    const announcement = {
      id: crypto.randomUUID(),
      title,
      message,
      createdAt: new Date().toISOString(),
      createdBy: req.sessionUser.name || req.sessionUser.email,
    };
    settings.announcements.unshift(announcement);
    settings.announcements = settings.announcements.slice(0, 50);
    await saveSettings(settings);
    announcementEvents.publish(announcement);
    res.status(201).json(settings);
  } catch (error) {
    next(error);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const remaining = settings.announcements.filter((announcement) => announcement.id !== req.params.id);
    if (remaining.length === settings.announcements.length) {
      return res.status(404).json({ error: "El anuncio no existe" });
    }
    settings.announcements = remaining;
    await saveSettings(settings);
    res.json(settings);
  } catch (error) {
    next(error);
  }
};