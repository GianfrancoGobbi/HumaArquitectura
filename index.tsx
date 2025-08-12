/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import ProjectDetail from './ProjectDetail';
import type { Project as ProjectData } from './ProjectDetail';
import WhatsAppButton from './WhatsAppButton';
import AdminPanel from './AdminPanel';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { type Database } from './untitled';
import './App.css'; // Import App specific styles

export type Project = ProjectData;

// Supabase Configuration - Hardcoded
const supabaseUrl = "https://hrebmkupyvyaqndqgtlb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZWJta3VweXZ5YXFuZHFndGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMTYzNTgsImV4cCI6MjA2OTg5MjM1OH0.xopHuNecCZWknSfIKh-FpbUVjl8ZrahXoWPgo6E5OGQ";

let supabase: SupabaseClient<Database>;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key is missing. Please check the hardcoded values.");
} else {
  supabase = createClient<Database>(supabaseUrl, supabaseKey);
}


const fallbackInitialProjects: Project[] = [
  { 
    id: 'arena_maipu_default', 
    name: 'Arenas de Maipú (Ejemplo de Fallback)', 
    coordinates: [-32.9750, -68.7750], 
    description: 'Un oasis de tranquilidad con lotes listos para construir (datos de fallback).', 
    details: 'Arenas de Maipú ofrece lotes desde 300m² en un entorno seguro y con acceso a servicios. Ideal para quienes buscan un estilo de vida conectado con la naturaleza sin alejarse de la ciudad. Contamos con espacios verdes comunes y financiación a medida. (Estos son datos de fallback).',
    media: [
      { type: 'image', src: 'https://picsum.photos/seed/arena_maipu_1_fallback/800/450', alt: 'Vista aérea de Arenas de Maipú (Fallback)' },
      { type: 'image', src: 'https://picsum.photos/seed/arena_maipu_2_fallback/800/450', alt: 'Lote modelo en Arenas de Maipú (Fallback)' },
    ]
  },
];

const DEFAULT_COORDINATES: [number, number] = [-32.976, -68.783]; 

function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!selectedProject && !showAdminPanel) {
        setNavScrolled(window.scrollY > 50);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedProject, showAdminPanel]);

  const fetchProjects = useCallback(async () => {
    if (!supabase) {
      setProjectsError("Supabase no está configurado. No se pueden cargar proyectos.");
      setIsLoadingProjects(false);
      setProjects(fallbackInitialProjects);
      return;
    }
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const { data, error } = await supabase
        .from('Proyectos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching projects from Supabase. Message:", error.message, "Full error:", error);
        setProjectsError(`Error al cargar proyectos: ${error.message || 'Error desconocido de Supabase.'}`);
        setProjects(fallbackInitialProjects); 
        return; 
      }
      
      const fetchedProjects: Project[] = data.map((p) => {
        let parsedCoords = DEFAULT_COORDINATES;
        if (p.coordinates) {
          if (Array.isArray(p.coordinates) && p.coordinates.length === 2 && typeof p.coordinates[0] === 'number' && typeof p.coordinates[1] === 'number') {
            parsedCoords = p.coordinates as [number, number];
          } else if (typeof p.coordinates === 'string') {
            try {
              const coordsFromString = JSON.parse(p.coordinates);
              if (Array.isArray(coordsFromString) && coordsFromString.length === 2 && typeof coordsFromString[0] === 'number' && typeof coordsFromString[1] === 'number') {
                parsedCoords = coordsFromString as [number, number];
              }
            } catch (e) {
              console.warn(`Failed to parse coordinates string for project ${p.id}:`, p.coordinates, e);
            }
          }
        }

        let parsedMedia = [];
        if (p.media) {
          if (Array.isArray(p.media)) {
            parsedMedia = p.media;
          } else if (typeof p.media === 'string') {
            try {
              parsedMedia = JSON.parse(p.media);
              if (!Array.isArray(parsedMedia)) parsedMedia = [];
            } catch (e) {
              console.warn(`Failed to parse media string for project ${p.id}:`, p.media, e);
              parsedMedia = [];
            }
          }
        }
        
        const shortDescription = p.map_description || (p.descripcion ? p.descripcion.substring(0, 100) + (p.descripcion.length > 100 ? '...' : '') : 'Descripción corta no disponible.');

        return {
          id: String(p.id), 
          name: p.nombre || 'Nombre no disponible',
          coordinates: parsedCoords,
          description: shortDescription,
          details: p.descripcion || 'Detalles no disponibles.', 
          media: parsedMedia,
        };
      });


      if (fetchedProjects.length === 0) {
        setProjects([]); 
      } else {
        setProjects(fetchedProjects);
      }

    } catch (err: any) { 
      console.error("Unexpected error in fetchProjects:", err);
      setProjectsError(`No se pudieron cargar los proyectos (error inesperado): ${err.message || 'Intente más tarde.'}`);
      setProjects(fallbackInitialProjects); 
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  
  const initializeOrUpdateMap = useCallback(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView(DEFAULT_COORDINATES, 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    } else {
      mapInstanceRef.current.eachLayer(layer => {
        if (layer instanceof L.Marker) {
          mapInstanceRef.current?.removeLayer(layer);
        }
      });
    }

    projects.forEach(project => {
      if (project.coordinates && project.coordinates.length === 2 && 
          typeof project.coordinates[0] === 'number' && typeof project.coordinates[1] === 'number') {
        const marker = L.marker(project.coordinates as L.LatLngTuple).addTo(mapInstanceRef.current!);
        const popupContent = `
          <div class="popup-content-container">
            <h3>${project.name}</h3>
            <p>${project.description}</p>
            <button class="view-project-button" data-projectid="${project.id}">Ver Proyecto</button>
          </div>
        `;
        marker.bindPopup(popupContent);

        marker.on('mouseover', function () {
          if (!this.isPopupOpen()) {
             this.openPopup();
          }
        });
      } else {
        console.warn('Project with invalid or missing coordinates, not adding marker:', project.name, project.coordinates);
      }
    });
    
    if (mapInstanceRef.current) { 
        mapInstanceRef.current.invalidateSize();
    }
  }, [projects]); 

  const destroyMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const handleViewProjectButtonClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('view-project-button') && target.closest('.leaflet-popup-content')) {
      event.preventDefault();
      event.stopPropagation(); 

      const projectId = target.getAttribute('data-projectid');
      if (projectId) {
        const projectToSelect = projects.find(p => p.id === projectId);
        if (projectToSelect) {
          setSelectedProject(projectToSelect);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  }, [projects, setSelectedProject]);

  useEffect(() => {
    if (!selectedProject && !showAdminPanel && (!isLoadingProjects || projectsError || projects.length > 0)) {
      initializeOrUpdateMap();
      document.addEventListener('click', handleViewProjectButtonClick, true);
    } else {
      destroyMap();
    }
    
    return () => {
      document.removeEventListener('click', handleViewProjectButtonClick, true);
    };
  }, [selectedProject, showAdminPanel, projects, isLoadingProjects, projectsError, initializeOrUpdateMap, handleViewProjectButtonClick]);
  
   useEffect(() => {
    return () => {
      destroyMap();
      document.removeEventListener('click', handleViewProjectButtonClick, true);
    };
  }, [handleViewProjectButtonClick]);


  const handleBackToMapOrApp = () => {
    setSelectedProject(null);
    setShowAdminPanel(false); 
    const homeElement = document.getElementById('home');
    if (homeElement) {
        setTimeout(() => homeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } else {
        window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };
  
  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const handleToggleAdminPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedProject(null); 
    setShowAdminPanel(prev => !prev);
    if (!showAdminPanel) { 
        window.scrollTo({ top: 0, behavior: 'smooth'});
    } else { 
        handleBackToMapOrApp();
    }
  };
  
  const handleNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setIsNavOpen(false); // Close mobile nav on link click
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (targetId === '#home') {
       window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const genericWhatsappMessage = "Hola, estoy interesado/a en los proyectos inmobiliarios.";
  const featuredProject = projects.length > 0 ? projects[0] : null;

  const fallbackHeroSlides = [
    { src: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop', alt: 'Vista de un desarrollo inmobiliario moderno', type: 'image' as const },
    { src: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1992&auto=format&fit=crop', alt: 'Exterior de una casa residencial de lujo', type: 'image' as const },
    { src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop', alt: 'Interior espacioso y luminoso de una casa moderna', type: 'image' as const }
  ];

  const projectImages = featuredProject?.media.filter(m => m.type === 'image');

  const heroSlides = (projectImages && projectImages.length > 1)
    ? projectImages
    : fallbackHeroSlides;


  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const intervalId = setInterval(() => {
        setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(intervalId);
  }, [heroSlides.length]);

  const goToNextHeroSlide = useCallback(() => {
    setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const goToPrevHeroSlide = useCallback(() => {
      setCurrentHeroSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);


  return (
    <div className="app-container">
        {showAdminPanel ? (
          <AdminPanel 
            supabaseClient={supabase}
            onDataMutated={fetchProjects} 
            onBackToApp={handleBackToMapOrApp}
          />
        ) : selectedProject ? (
          <ProjectDetail project={selectedProject} onBackToMap={handleBackToMapOrApp} />
        ) : (
            <>
                <nav className={`app-nav ${navScrolled ? 'scrolled' : ''} ${isNavOpen ? 'nav-open' : ''}`}>
                    <div className="nav-container">
                        <a href="#home" onClick={(e) => handleNavLinkClick(e, '#home')} className="nav-logo">
                            <img src="https://hrebmkupyvyaqndqgtlb.supabase.co/storage/v1/object/public/images/IMAGEN%20HUMA%2011%20blanco.png" alt="HUMA Arquitectura Logo" className="logo-image" />
                        </a>
                        <button className="nav-toggle" onClick={() => setIsNavOpen(!isNavOpen)} aria-label="Toggle navigation" aria-expanded={isNavOpen}>
                             <span className="hamburger-box">
                                <span className="hamburger-inner"></span>
                            </span>
                        </button>
                        <div className="nav-links">
                            <a href="#about-us" onClick={(e) => handleNavLinkClick(e, '#about-us')}>Nosotros</a>
                            <a href="#nuestros-proyectos" onClick={(e) => handleNavLinkClick(e, '#nuestros-proyectos')}>Unidades de negocio</a>
                            <a href="#nuestros-proyectos" onClick={(e) => handleNavLinkClick(e, '#nuestros-proyectos')}>Novedades</a>
                            <a href="#contacto" onClick={(e) => handleNavLinkClick(e, '#contacto')}>Contacto</a>
                        </div>
                    </div>
                </nav>

                <header id="home" className="hero-section">
                    <div 
                      className="hero-slider-wrapper" 
                      style={{ transform: `translateX(-${currentHeroSlide * 100}%)` }}
                    >
                      {heroSlides.map((slide, index) => (
                          <div
                              key={slide.src + index}
                              className="hero-slide"
                              style={{ backgroundImage: `url(${slide.src})` }}
                              role="img"
                              aria-label={slide.alt || 'Diapositiva del carrusel de bienvenida'}
                          />
                      ))}
                    </div>

                    <div className="hero-overlay"></div>
                    <div className="hero-content">
                        <h1>Desarrollos inmobiliarios</h1>
                    </div>
                    {heroSlides.length > 1 && (
                      <>
                        <button onClick={goToPrevHeroSlide} className="hero-carousel-button prev" aria-label="Diapositiva anterior">‹</button>
                        <button onClick={goToNextHeroSlide} className="hero-carousel-button next" aria-label="Siguiente diapositiva">›</button>
                        <div className="hero-carousel-dots">
                          {heroSlides.map((_, index) => (
                            <span
                              key={index}
                              className={`dot ${index === currentHeroSlide ? 'active' : ''}`}
                              onClick={() => setCurrentHeroSlide(index)}
                              aria-label={`Ir a diapositiva ${index + 1}`}
                            ></span>
                          ))}
                        </div>
                      </>
                    )}
                    <a href="#map-container" onClick={(e) => handleNavLinkClick(e, '#map-container')} className="scroll-down-indicator" aria-label="Scroll down">
                        <div className="scroll-down-icon"></div>
                    </a>
                </header>

                <main className="main-content">
                    {isLoadingProjects && (
                      <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em' }}>
                        Cargando proyectos...
                      </div>
                    )}
                    {projectsError && (
                       <div className="admin-message error-message" style={{ margin: '20px auto', maxWidth: 'var(--max-content-width)'}} role="alert">
                         {projectsError}
                       </div>
                    )}

                    {!isLoadingProjects && !projectsError && (
                        <>
                            <div 
                              id="map-container" 
                              ref={mapContainerRef} 
                              aria-label="Mapa de proyectos en Maipú, Mendoza" 
                            >
                              {/* The map will be rendered here by Leaflet */}
                            </div>
                           
                            {projects.length === 0 ? (
                               <div style={{ textAlign: 'center', padding: '30px', fontSize: '1.1em', color: 'var(--primary-gray)' }}>
                                 Actualmente no hay proyectos para mostrar.
                               </div>
                            ) : (
                               <section id="nuestros-proyectos" className="content-section projects-grid-section" aria-labelledby="nuestros-proyectos-heading">
                                <div className="section-container">
                                  <h2 id="nuestros-proyectos-heading">Nuestros Proyectos</h2>
                                  <div className="projects-grid">
                                    {projects.map(project => (
                                      <div key={project.id} className="project-card">
                                        <div className="project-card-image">
                                          <img src={project.media[0]?.src || 'https://picsum.photos/seed/default_card/400/300'} alt={project.media[0]?.alt || `Vista de ${project.name}`} />
                                        </div>
                                        <div className="project-card-content">
                                          <h3>{project.name}</h3>
                                          <p>{project.description}</p>
                                          <button onClick={() => handleSelectProject(project)} className="admin-button primary project-card-button">
                                            Ver Más
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </section>
                            )}

                            <section id="about-us" className="content-section about-us-section" aria-labelledby="about-us-heading">
                              <div className="section-container">
                                <h2 id="about-us-heading">Sobre Nosotros</h2>
                                <p>En Huma Arquitectura, transformamos ideas en realidades. Somos un equipo apasionado por el diseño y la construcción de espacios que inspiran y mejoran la calidad de vida. Con años de experiencia en el mercado inmobiliario de Mendoza, nos especializamos en crear proyectos residenciales únicos, combinando innovación, funcionalidad y un profundo respeto por el entorno.</p>
                                <p>Nuestra misión es acompañarte en cada paso hacia tu nuevo hogar o inversión, ofreciendo transparencia, profesionalismo y un compromiso inquebrantable con la excelencia.</p>
                              </div>
                            </section>

                            <section id="services" className="content-section services-section" aria-labelledby="services-heading">
                              <div className="section-container">
                                <h2 id="services-heading">Nuestros Servicios</h2>
                                <ul className="services-list">
                                  <li>
                                    <span className="service-icon" role="img" aria-label="Desarrollo">🏗️</span>
                                    <h3>Desarrollo Integral de Proyectos</h3>
                                    <p>Desde la concepción y diseño arquitectónico hasta la construcción y entrega final de barrios y complejos residenciales.</p>
                                  </li>
                                  <li>
                                    <span className="service-icon" role="img" aria-label="Venta">🏡</span>
                                    <h3>Venta de Lotes y Propiedades</h3>
                                    <p>Ofrecemos terrenos en ubicaciones estratégicas y propiedades listas para habitar, adaptadas a tus necesidades y sueños.</p>
                                  </li>
                                  <li>
                                    <span className="service-icon" role="img" aria-label="Asesoramiento">🤝</span>
                                    <h3>Asesoramiento Personalizado</h3>
                                    <p>Te guiamos durante todo el proceso de selección e inversión, asegurando una experiencia clara y satisfactoria.</p>
                                  </li>
                                </ul>
                              </div>
                            </section>
                        </>
                    )}
                </main>

                <footer id="contacto" className="app-footer">
                    <div className="section-container">
                    <div className="footer-contact-info">
                        <p>Email: <a href="mailto:humaarquitectura@hotmail.com" className="footer-link">humaarquitectura@hotmail.com</a></p>
                        <p>WhatsApp: <a href="https://wa.me/5492612765652" target="_blank" rel="noopener noreferrer" className="footer-link">+54 9 261 276-5652</a></p>
                    </div>
                    <div className="footer-social-media">
                        <a href="https://www.facebook.com/HumaArquitectura" target="_blank" rel="noopener noreferrer" className="footer-link">Facebook</a>
                        <span className="social-separator">|</span>
                        <a href="https://www.instagram.com/huma_arquitectura" target="_blank" rel="noopener noreferrer" className="footer-link">Instagram</a>
                    </div>
                    <div className="footer-admin-area">
                        <p>&copy; {new Date().getFullYear()} HUMA Arquitectura. Todos los derechos reservados.</p>
                        <p><a href="#" onClick={handleToggleAdminPanel} className="footer-link admin-panel-link">Panel de Administración</a></p>
                    </div>
                    </div>
                </footer>
                <WhatsAppButton 
                    phoneNumber="+5492612765652"
                    message={genericWhatsappMessage}
                    displayMode="fab"
                />
            </>
        )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} else {
  console.error('Root element not found');
}