import React, { useState } from 'react';
import './ProjectDetail.css'; // Import component-specific styles
import ProjectChatbot from './ProjectChatbot'; // Import the new ProjectChatbot component
import WhatsAppButton from './WhatsAppButton'; // Import WhatsAppButton

export interface ProjectMedia {
  type: 'image' | 'video';
  src: string;
  alt?: string;
}

export interface Project {
  id: string;
  name: string;
  coordinates: [number, number]; // Added coordinates property
  description: string;
  details: string;
  media: ProjectMedia[];
}

interface ProjectDetailProps {
  project: Project;
  onBackToMap: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBackToMap }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!project) return null;

  const { name, details, media } = project;

  const goToNextSlide = () => {
    setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % media.length);
  };

  const goToPrevSlide = () => {
    setCurrentSlideIndex((prevIndex) => (prevIndex - 1 + media.length) % media.length);
  };

  const currentMedia = media[currentSlideIndex];
  const whatsappProjectMessage = `Hola, estoy interesado/a en el proyecto "${project.name}". Quisiera más información.`;

  return (
    <div className="project-detail-view content-view-card" role="main" aria-live="polite">
      <h2>{name}</h2>
      
      {media && media.length > 0 && (
        <div className="carousel-container" aria-roledescription="carousel">
          <div className="carousel-slide">
            {currentMedia.type === 'image' ? (
              <img src={currentMedia.src} alt={currentMedia.alt || `Imagen de ${name} ${currentSlideIndex + 1}`} />
            ) : (
              <video src={currentMedia.src} controls title={currentMedia.alt || `Video de ${name} ${currentSlideIndex + 1}`}>
                Tu navegador no soporta el tag de video.
              </video>
            )}
          </div>
          {media.length > 1 && (
            <>
              <button onClick={goToPrevSlide} className="carousel-button prev" aria-label="Diapositiva anterior">‹</button>
              <button onClick={goToNextSlide} className="carousel-button next" aria-label="Siguiente diapositiva">›</button>
              <div className="carousel-dots">
                {media.map((_, index) => (
                  <span
                    key={index}
                    className={`dot ${index === currentSlideIndex ? 'active' : ''}`}
                    onClick={() => setCurrentSlideIndex(index)}
                    aria-label={`Ir a diapositiva ${index + 1}`}
                  ></span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <p>{details}</p>
      
      <div className="project-detail-actions">
        <WhatsAppButton
          phoneNumber="+5492612765652"
          message={whatsappProjectMessage}
          displayMode="inline"
        />
        <button 
          onClick={onBackToMap} 
          className="back-to-map-button admin-button secondary" // Added admin-button and secondary for consistency
          aria-label="Volver al mapa">
          Volver al Mapa
        </button>
      </div>

      <ProjectChatbot project={project} isVisible={true} />
    </div>
  );
};

export default ProjectDetail;