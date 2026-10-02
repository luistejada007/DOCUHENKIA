export default function LoadingOverlay({ message, detail }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay__content">
        <span className="loading-spinner" aria-hidden="true" />
        <strong>{message}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}