import { LinkButton } from './ui.jsx';
import { waLink } from '../lib/format.js';

// Call and WhatsApp. WhatsApp opens a chat with the message filled in; the admin sends it.
export function Contact({ phone, message }) {
  if (!phone) return <span className="muted">No phone</span>;
  const wa = waLink(phone, message);
  return (
    <>
      <LinkButton href={`tel:${phone}`} size="small" variant="text">Call</LinkButton>
      {wa && (
        <LinkButton href={wa} target="_blank" rel="noopener" size="small">
          WhatsApp
        </LinkButton>
      )}
    </>
  );
}
