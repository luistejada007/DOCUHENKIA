export default function AnnouncementNotification({ announcement, onDismiss }) {
  return (
    <section className="announcement-notification" role="status" aria-live="polite">
      <div className="announcement-notification__header">
        <strong>DOCUHENKIA</strong>
        <span>NUEVO</span>
        <button type="button" onClick={onDismiss} aria-label="Cerrar notificación">×</button>
      </div>
      <p className="announcement-notification__author">
        <strong>{announcement.createdBy}</strong> publicó una novedad
      </p>
      <h2>{announcement.title}</h2>
      <p className="announcement-notification__message">{announcement.message}</p>
    </section>
  );
}