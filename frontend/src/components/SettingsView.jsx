import { useEffect, useState } from 'react';

export default function SettingsView({ settings, onSaveTheme, onPublishAnnouncement }) {
  const [themeColor, setThemeColor] = useState(settings.themeColor);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => setThemeColor(settings.themeColor), [settings.themeColor]);

  const saveTheme = async (event) => {
    event.preventDefault();
    setIsSavingTheme(true);
    await onSaveTheme(themeColor);
    setIsSavingTheme(false);
  };

  const publishAnnouncement = async (event) => {
    event.preventDefault();
    setIsPublishing(true);
    const published = await onPublishAnnouncement({ title, message });
    if (published) {
      setTitle('');
      setMessage('');
    }
    setIsPublishing(false);
  };

  return (
    <section className="settings-page">
      <header className="settings-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Configuración</h1>
          <p>Personaliza la apariencia y comparte novedades con todo el equipo.</p>
        </div>
      </header>

      <section className="settings-section" aria-labelledby="theme-heading">
        <div className="settings-section-heading">
          <div>
            <h2 id="theme-heading">Color de la página</h2>
            <p>El cambio se aplicará a todos los usuarios.</p>
          </div>
        </div>
        <form className="theme-form" onSubmit={saveTheme}>
          <label className="theme-picker-label" htmlFor="theme-color">Color principal</label>
          <input
            id="theme-color"
            className="theme-color-input"
            type="color"
            value={themeColor}
            onChange={(event) => setThemeColor(event.target.value)}
          />
          <span className="theme-color-value">{themeColor.toUpperCase()}</span>
          <button className="primary-btn" type="submit" disabled={isSavingTheme}>
            {isSavingTheme ? 'Guardando...' : 'Guardar color'}
          </button>
        </form>
      </section>

      <section className="settings-section" aria-labelledby="announcement-heading">
        <div className="settings-section-heading">
          <div>
            <h2 id="announcement-heading">Anuncio para el equipo</h2>
            <p>Se mostrará a todos los usuarios, por ejemplo cuando haya nueva documentación.</p>
          </div>
        </div>
        <form className="announcement-form" onSubmit={publishAnnouncement}>
          <label htmlFor="announcement-title">Título</label>
          <input
            id="announcement-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            placeholder="Nueva documentación disponible"
            required
          />
          <label htmlFor="announcement-message">Mensaje</label>
          <textarea
            id="announcement-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Comparte el nombre o la ubicación del documento..."
            required
          />
          <div className="announcement-form-footer">
            <span>{message.length}/500</span>
            <button className="primary-btn" type="submit" disabled={isPublishing || !title.trim() || !message.trim()}>
              {isPublishing ? 'Publicando...' : 'Publicar anuncio'}
            </button>
          </div>
        </form>
      </section>

    </section>
  );
}