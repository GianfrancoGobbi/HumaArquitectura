import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Project, ProjectMedia } from './ProjectDetail';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './untitled';
import L from 'leaflet';
import './ProjectForm.css'; // Import component-specific styles

const FORM_DEFAULT_COORDINATES: [number, number] = [-32.976, -68.783]; // Maipú, Mendoza

// Define the shape of a media item being managed in the form's state
interface MediaItemDisplay {
  key: string; // Unique key for React rendering
  src: string; // URL (blob for local previews, Supabase URL for existing/uploaded)
  alt: string;
  file?: File; // The actual File object for new local uploads
  type: 'image' | 'video';
  isNewUpload: boolean; // True if this item was selected locally and needs to be uploaded
}

interface ProjectFormProps {
  initialProject: Project | null;
  onSubmit: (projectData: Omit<Project, 'id'> & { id?: string }, originalId: string | null) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting: boolean;
  formError: string | null;
  supabaseClient: SupabaseClient<Database>; // Added Supabase client for storage operations
}

const ProjectForm: React.FC<ProjectFormProps> = ({ 
  initialProject, 
  onSubmit, 
  onCancel, 
  isSubmitting: parentIsSubmitting, 
  formError: parentFormError,
  supabaseClient,
}) => {
  const [projectName, setProjectName] = useState('');
  const [coordinatesStr, setCoordinatesStr] = useState('');
  const [mapDescription, setMapDescription] = useState('');
  const [details, setDetails] = useState('');
  const [aiKeywords, setAiKeywords] = useState('');
  
  const [currentMediaItems, setCurrentMediaItems] = useState<MediaItemDisplay[]>([]);
  const [newMediaAltText, setNewMediaAltText] = useState('');
  
  const [internalFormError, setInternalFormError] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [isApiKeyAvailable, setIsApiKeyAvailable] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    // Check for API Key availability on component mount
    if (process.env.API_KEY) {
      setIsApiKeyAvailable(true);
    } else {
      setIsApiKeyAvailable(false);
      console.warn("API Key de Gemini (process.env.API_KEY) no está configurada. La función de sugerencia de IA estará deshabilitada.");
    }
  }, []);

  // Initialize or update form fields based on initialProject
  useEffect(() => {
    setInternalFormError(null);
    setAiSuccessMessage(null);
    let initialCoords = FORM_DEFAULT_COORDINATES;

    if (initialProject) {
      setProjectName(initialProject.name);
      if (initialProject.coordinates && 
          Array.isArray(initialProject.coordinates) && 
          initialProject.coordinates.length === 2 &&
          typeof initialProject.coordinates[0] === 'number' &&
          typeof initialProject.coordinates[1] === 'number') {
        initialCoords = [
            parseFloat(initialProject.coordinates[0].toFixed(5)),
            parseFloat(initialProject.coordinates[1].toFixed(5))
        ];
      }
      setCoordinatesStr(JSON.stringify(initialCoords));
      setMapDescription(initialProject.description);
      setDetails(initialProject.details);
      
      const initialMediaForDisplay = initialProject.media.map((m, idx) => ({
        key: m.src || `existing-${idx}-${Date.now()}`,
        src: m.src,
        alt: m.alt || '',
        type: m.type,
        isNewUpload: false,
        file: undefined,
      }));
      setCurrentMediaItems(initialMediaForDisplay);
      setAiKeywords('');
    } else {
      // New project
      setProjectName('');
      setCoordinatesStr(JSON.stringify(FORM_DEFAULT_COORDINATES));
      setMapDescription('');
      setDetails('');
      setCurrentMediaItems([]);
      setAiKeywords('');
    }
  }, [initialProject]);

  // Initialize and manage Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let currentCoords = FORM_DEFAULT_COORDINATES;
    try {
      const parsed = JSON.parse(coordinatesStr);
      if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
        currentCoords = [parseFloat(parsed[0].toFixed(5)), parseFloat(parsed[1].toFixed(5))];
      }
    } catch (e) { /* Use default if parsing fails */ }

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView(currentCoords, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      mapInstanceRef.current = map;

      const marker = L.marker(currentCoords, { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const latLng = marker.getLatLng();
        const newCoords: [number, number] = [parseFloat(latLng.lat.toFixed(5)), parseFloat(latLng.lng.toFixed(5))];
        setCoordinatesStr(JSON.stringify(newCoords));
      });
      markerRef.current = marker;
    } else {
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      if (marker) {
        const markerLatLng = marker.getLatLng();
        if (markerLatLng.lat.toFixed(5) !== currentCoords[0].toFixed(5) || markerLatLng.lng.toFixed(5) !== currentCoords[1].toFixed(5)) {
          marker.setLatLng(currentCoords);
        }
      }
      const currentMapView = map.getCenter();
      if (currentMapView.lat.toFixed(3) !== currentCoords[0].toFixed(3) || currentMapView.lng.toFixed(3) !== currentCoords[1].toFixed(3)) {
           map.setView(currentCoords, map.getZoom());
      }
    }
    
    mapInstanceRef.current?.invalidateSize();

  }, [coordinatesStr]); 

   // Cleanup map on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);


  const handleSuggestDescription = async () => {
    if (!isApiKeyAvailable) {
      setInternalFormError("API Key de Gemini (process.env.API_KEY) no está configurada correctamente.");
      return;
    }
    if (!projectName && !initialProject?.name) {
      setInternalFormError("Por favor, ingrese un nombre de proyecto para generar la descripción.");
      return;
    }
    setIsLoadingAi(true);
    setInternalFormError(null);
    setAiSuccessMessage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // Safe due to isApiKeyAvailable check
      const currentProjectName = projectName || initialProject?.name || "un proyecto";
      const promptContent = `Genera una descripción atractiva y concisa (1-2 frases) para un proyecto inmobiliario llamado "${currentProjectName}". 
Palabras clave/detalles adicionales: "${aiKeywords || 'ninguno'}".
Esta descripción se usará en un popup de mapa.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptContent,
      });
      
      setMapDescription(response.text);
      setAiSuccessMessage("Descripción corta sugerida por IA generada.");
    } catch (e: any) {
      console.error("Error fetching AI description:", e);
      setInternalFormError(`Error al generar descripción con IA: ${e.message || 'Error desconocido.'}`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      const newItems: MediaItemDisplay[] = filesArray.map(file => ({
        key: self.crypto.randomUUID(),
        src: URL.createObjectURL(file),
        alt: newMediaAltText || file.name,
        file: file,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        isNewUpload: true,
      }));
      setCurrentMediaItems(prev => [...prev, ...newItems]);
      setNewMediaAltText('');
      event.target.value = '';
    }
  };

  const handleRemoveMedia = (keyToRemove: string) => {
    setCurrentMediaItems(prev =>
      prev.filter(item => {
        if (item.key === keyToRemove && item.isNewUpload && item.src.startsWith('blob:')) {
          URL.revokeObjectURL(item.src);
        }
        return item.key !== keyToRemove;
      })
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInternalFormError(null);
    setAiSuccessMessage(null);

    let parsedCoordinates: [number, number];
    try {
      const coords = JSON.parse(coordinatesStr);
      if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(c => typeof c === 'number')) {
        throw new Error('Debe ser un array JSON de dos números.');
      }
      parsedCoordinates = [parseFloat(coords[0].toFixed(5)), parseFloat(coords[1].toFixed(5))];
    } catch (error) {
      setInternalFormError('Formato de coordenadas JSON inválido. Use: [-32.123, -68.456]');
      return;
    }

    if (!projectName.trim() || !mapDescription.trim() || !details.trim()) {
        setInternalFormError('Nombre, Descripción Corta (mapa) y Detalles Completos son campos requeridos.');
        return;
    }

    const finalMediaPayload: ProjectMedia[] = [];

    for (const item of currentMediaItems) {
      if (item.isNewUpload && item.file) {
        const uniqueFileName = `${Date.now()}_${item.file.name.replace(/\s+/g, '_')}`;
        const filePath = uniqueFileName;

        const { error: uploadError } = await supabaseClient.storage
          .from('images')
          .upload(filePath, item.file, { upsert: false });

        if (uploadError) {
          setInternalFormError(`Error al subir archivo ${item.file.name}: ${uploadError.message}`);
          return; 
        }
        
        const { data: publicUrlData } = supabaseClient.storage.from('images').getPublicUrl(filePath);
        if (!publicUrlData || !publicUrlData.publicUrl) {
            setInternalFormError(`No se pudo obtener la URL pública para ${item.file.name}.`);
            return;
        }

        finalMediaPayload.push({
          type: item.type,
          src: publicUrlData.publicUrl,
          alt: item.alt,
        });
        URL.revokeObjectURL(item.src);
      } else if (!item.isNewUpload) {
        finalMediaPayload.push({
          type: item.type,
          src: item.src,
          alt: item.alt,
        });
      }
    }

    const projectData = {
      name: projectName,
      coordinates: parsedCoordinates,
      description: mapDescription, 
      details: details,
      media: finalMediaPayload,
    };

    await onSubmit(projectData, initialProject ? initialProject.id : null);
  };

  return (
    <div className="project-form-view content-view-card" role="form" aria-labelledby="project-form-heading">
      <h2 id="project-form-heading">
        {initialProject ? 'Editar Proyecto' : 'Agregar Nuevo Proyecto'}
      </h2>
      <p>
        Complete los detalles del proyecto. La descripción corta es para el mapa, los detalles completos para la página del proyecto.
      </p>
      
      {(internalFormError || parentFormError) && 
        <p className="admin-message error-message" role="alert">{internalFormError || parentFormError}</p>}
      {aiSuccessMessage && <p className="admin-message success-message" role="alert">{aiSuccessMessage}</p>}

      <form onSubmit={handleSubmit} className="admin-form" id="projectForm">
        <div className="form-group">
          <label htmlFor="projectName">Nombre del Proyecto:</label>
          <input type="text" id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
        </div>

        <div className="form-group">
          <label htmlFor="coordinates">Coordenadas (JSON Array o seleccionar en mapa):</label>
          <input 
            type="text" 
            id="coordinates" 
            value={coordinatesStr} 
            onChange={(e) => {
              setCoordinatesStr(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
                  const newMapCoords: [number, number] = [parseFloat(parsed[0].toFixed(5)), parseFloat(parsed[1].toFixed(5))];
                  if (mapInstanceRef.current && markerRef.current) {
                    markerRef.current.setLatLng(newMapCoords);
                    mapInstanceRef.current.setView(newMapCoords);
                  }
                }
              } catch (err) { /* Invalid JSON, do nothing to the map */ }
            }} 
            placeholder='Ej: [-32.123, -68.456]' 
            required 
            aria-describedby="coordinates-map-description"
          />
          <div 
            id="project-form-map-container" 
            ref={mapContainerRef} 
            aria-hidden="true"
          ></div>
          <p id="coordinates-map-description" className="sr-only">
            Puede ingresar las coordenadas manualmente en formato JSON, por ejemplo [-32.123, -68.456], o arrastrar el marcador en el mapa de arriba para seleccionarlas.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="mapDescription">Descripción Corta (para el mapa y AI):</label>
          <textarea id="mapDescription" value={mapDescription} onChange={(e) => setMapDescription(e.target.value)} rows={3} required maxLength={150} />
        </div>
        
        <div className="form-group">
          <label htmlFor="aiKeywords">Palabras Clave para IA (opcional, para descripción corta):</label>
          <input type="text" id="aiKeywords" value={aiKeywords} onChange={(e) => setAiKeywords(e.target.value)} placeholder="Ej: lotes amplios, vistas montaña, seguridad" />
           <button type="button" onClick={handleSuggestDescription} disabled={isLoadingAi || !isApiKeyAvailable} className="ai-suggest-button" style={{marginTop: '10px'}} title={!isApiKeyAvailable ? "API Key de Gemini no configurada" : "Sugerir descripción con IA"}>
            {isLoadingAi ? 'Generando...' : 'Sugerir Descripción Corta con IA'}
          </button>
          {!isApiKeyAvailable && 
           <p style={{fontSize: '0.8em', color: 'var(--error-color)', marginTop: '5px'}}>API Key de Gemini (process.env.API_KEY) no disponible. Función de IA deshabilitada.</p>}
        </div>

        <div className="form-group">
          <label htmlFor="details">Detalles Completos del Proyecto (para la página del proyecto):</label>
          <textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} rows={6} required />
        </div>

        <div className="form-group">
          <label>Media del Proyecto (Imágenes/Videos):</label>
          {currentMediaItems.length > 0 && (
            <div className="media-items-list">
              {currentMediaItems.map((item) => (
                <div key={item.key} className="media-item-entry">
                  {item.type === 'image' ? (
                    <img src={item.src} alt={item.alt || 'Vista previa'} className="media-item-preview-img" />
                  ) : (
                    <video src={item.src} controls className="media-item-preview-img" title={item.alt || 'Vista previa de video'} />
                  )}
                  <div className="media-item-info">
                    <p className="media-item-alt">{item.alt}</p>
                    <p className="media-item-filename" title={item.file?.name || item.src}>{item.file ? item.file.name : (item.src.split('/').pop() || item.src)}</p>
                    {item.isNewUpload && <span className="media-item-status">(Nuevo)</span>}
                  </div>
                  <button type="button" onClick={() => handleRemoveMedia(item.key)} className="admin-button media-remove-button">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="add-media-controls">
            <label htmlFor="newMediaAltText" className="sr-only">Texto Alternativo para nueva media:</label>
            <input
              type="text"
              id="newMediaAltText"
              value={newMediaAltText}
              onChange={(e) => setNewMediaAltText(e.target.value)}
              placeholder="Texto alternativo para nuevas imágenes"
              className="new-media-alt-input"
            />
            <label htmlFor="mediaFiles" className="admin-button media-upload-label-button">
              Seleccionar Archivos
            </label>
            <input
              type="file"
              id="mediaFiles"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }} 
            />
          </div>
        </div>
      </form>
      <div className="admin-form-actions">
          <button type="submit" form="projectForm" className="admin-button primary" disabled={parentIsSubmitting}>
            {parentIsSubmitting ? 'Guardando...' : (initialProject ? 'Actualizar Proyecto' : 'Agregar Proyecto')}
          </button>
          <button type="button" onClick={onCancel} className="admin-button secondary" disabled={parentIsSubmitting}>
              Cancelar
          </button>
      </div>
    </div>
  );
};

export default ProjectForm;