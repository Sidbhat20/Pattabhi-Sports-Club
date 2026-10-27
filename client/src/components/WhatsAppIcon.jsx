// WhatsApp mark: green roundel, white speech bubble with a handset.
export function WhatsAppIcon({ size = 20, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#25d366" />
      <path
        d="M12 5.2a6.8 6.8 0 0 0-5.9 10.2l-.8 2.9 3-.8A6.8 6.8 0 1 0 12 5.2z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 9.4c.2-.3.4-.3.6-.3h.3c.1 0 .2 0 .3.2l.4 1c.1.2 0 .3-.1.4l-.2.3c.3.7.9 1.3 1.6 1.6l.3-.2c.1-.1.3-.2.4-.1l.9.4c.2.1.2.2.2.4v.3c0 .5-.4.9-1 .9-1.9-.2-3.5-1.8-3.7-3.6 0-.5.3-.9.7-1.1z"
        fill="#25d366"
      />
    </svg>
  );
}
