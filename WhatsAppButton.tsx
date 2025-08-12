import React from 'react';
import './WhatsAppButton.css'; // Import component-specific styles

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
  displayMode?: 'fab' | 'inline';
}

// Standard WhatsApp SVG Icon
const WhatsAppSVGIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" style={{ fill: 'white' }}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.77 3.05 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91s-4.45-9.91-9.91-9.91zM12.04 3.65c4.52 0 8.21 3.69 8.21 8.21s-3.69 8.21-8.21 8.21c-1.53 0-3-.42-4.29-1.16l-.3-.18-3.18.83.85-3.1-.2-.32c-.82-1.32-1.26-2.84-1.26-4.42 0-4.52 3.69-8.21 8.21-8.21zm4.52 9.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.23-.75-.66-1.26-1.47-1.41-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44s.17-.25.25-.42c.08-.17.04-.31-.02-.44s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.07s.89 2.41 1.01 2.58c.12.17 1.76 2.67 4.27 3.77 2.51 1.09 2.51.73 2.96.7" />
  </svg>
);

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber,
  message = "Hola, estoy interesado/a en sus servicios.",
  displayMode = 'fab' // Default to 'fab'
}) => {
  const encodedMessage = encodeURIComponent(message);
  const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  const buttonClasses = displayMode === 'fab'
    ? 'whatsapp-fab'
    : 'whatsapp-inline-button admin-button'; // Use admin-button for base styling in inline mode

  return (
    <a
      href={whatsappLink}
      className={buttonClasses}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
    >
      <WhatsAppSVGIcon />
      {displayMode === 'inline' && (
        <span style={{ marginLeft: '10px' }}>Contactar por WhatsApp</span>
      )}
    </a>
  );
};

export default WhatsAppButton;