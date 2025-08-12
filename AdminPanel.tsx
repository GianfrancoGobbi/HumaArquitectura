import React, { useState, FormEvent, useEffect, useCallback } from 'react';
import type { Project as ProjectData, ProjectMedia } from './ProjectDetail';
import ProjectForm from './ProjectForm'; // New component
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './untitled';
import './AdminPanel.css'; // Import component-specific styles

export type Project = ProjectData;

// Admin Credentials - Hardcoded
const HARDCODED_ADMIN_USERNAME = "admin";
const HARDCODED_ADMIN_PASSWORD = "password123";

// Default coordinates for projects if not specified in DB, for AdminPanel context
const ADMIN_DEFAULT_COORDINATES: [number, number] = [-32.976, -68.783];

interface AdminPanelProps {
  supabaseClient: SupabaseClient<Database>;
  onDataMutated: () => Promise<void>; // To refresh main app's project list
  onBackToApp: () => void;
}

type AdminView = 'login' | 'list' | 'form';

const AdminPanel: React.FC<AdminPanelProps> = ({ supabaseClient, onDataMutated, onBackToApp }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [adminView, setAdminView] = useState<AdminView>('login');
  const [adminProjects, setAdminProjects] = useState<Project[]>([]);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  
  const [isLoadingAdminProjects, setIsLoadingAdminProjects] = useState(false);
  const [adminProjectsError, setAdminProjectsError] = useState<string | null>(null);
  
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);


  const fetchAdminProjects = useCallback(async () => {
    if (!supabaseClient) {
        setAdminProjectsError("Supabase client no disponible.");
        return;
    }
    setIsLoadingAdminProjects(true);
    setAdminProjectsError(null);
    try {
      const { data, error } = await supabaseClient
        .from('Proyectos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching admin projects from Supabase:", error);
        setAdminProjectsError(`Error al cargar proyectos para admin: ${error.message}`);
        setAdminProjects([]);
        return;
      }
      
      const fetchedProjects: Project[] = data.map((p) => {
        let parsedCoords = ADMIN_DEFAULT_COORDINATES;
        if (p.coordinates) {
            if (Array.isArray(p.coordinates) && p.coordinates.length === 2 && typeof p.coordinates[0] === 'number' && typeof p.coordinates[1] === 'number') {
              parsedCoords = p.coordinates as [number, number];
            } else if (typeof p.coordinates === 'string') {
              try {
                const coordsFromString = JSON.parse(p.coordinates);
                if (Array.isArray(coordsFromString) && coordsFromString.length === 2 && typeof coordsFromString[0] === 'number' && typeof coordsFromString[1] === 'number') {
                  parsedCoords = coordsFromString as [number, number];
                }
              } catch (e) { /* ignore parsing error, use default */ }
            }
        }

        let parsedMedia: ProjectMedia[] = [];
        if (p.media) {
            if (Array.isArray(p.media)) {
                parsedMedia = p.media as ProjectMedia[];
            } else if (typeof p.media === 'string') {
                try {
                    const mediaFromString = JSON.parse(p.media);
                    if (Array.isArray(mediaFromString)) {
                        parsedMedia = mediaFromString as ProjectMedia[];
                    }
                } catch (e) { /* ignore parsing error */ }
            }
        }
        
        return {
          id: String(p.id),
          name: p.nombre || 'Sin Nombre',
          coordinates: parsedCoords,
          description: p.map_description || (p.descripcion ? p.descripcion.substring(0,70) + '...' : 'Sin descripción corta'),
          details: p.descripcion || 'Sin detalles',
          media: parsedMedia,
        };
      });
      setAdminProjects(fetchedProjects);
    } catch (e: any) {
      console.error("Unexpected error fetching admin projects:", e);
      setAdminProjectsError(`Error inesperado: ${e.message}`);
      setAdminProjects([]);
    } finally {
      setIsLoadingAdminProjects(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (isLoggedIn && adminView === 'list') {
      fetchAdminProjects();
    }
  }, [isLoggedIn, adminView, fetchAdminProjects]);

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (loginUsername === HARDCODED_ADMIN_USERNAME && loginPassword === HARDCODED_ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      setAdminView('list');
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdminView('login');
    setProjectToEdit(null);
    setAdminProjects([]);
    onBackToApp(); // This will also navigate the main app view
  };

  const handleAddNewProjectClick = () => {
    setProjectToEdit(null);
    setAdminView('form');
    setFormError(null);
    setFormSuccessMessage(null);
  };

  const handleEditProjectClick = (project: Project) => {
    setProjectToEdit(project);
    setAdminView('form');
    setFormError(null);
    setFormSuccessMessage(null);
  };

  const handleFormCancel = () => {
    setAdminView('list');
    setProjectToEdit(null);
    setFormError(null);
    setFormSuccessMessage(null);
  };

  const handleProjectFormSubmit = async (
    projectData: Omit<Project, 'id' | 'created_at'> & { id?: string }, 
    originalId: string | null
  ) => {
    if (!supabaseClient) {
        setFormError("Supabase client no disponible.");
        return false;
    }
    setFormSubmitting(true);
    setFormError(null);
    setFormSuccessMessage(null);

    // By letting TypeScript infer the payload's type, we avoid a bug where
    // explicitly annotating with a complex recursive type like Supabase's 'Json'
    // can cause a "Type instantiation is excessively deep" error. The inferred
    // type is compatible with the 'Insert' and 'Update' types.
    const payload = {
      nombre: projectData.name,
      map_description: projectData.description,
      descripcion: projectData.details,
      coordinates: projectData.coordinates,
      media: projectData.media,
    };

    try {
      let responseError = null;
      if (originalId) { // Editing existing project
        // The `update` method accepts a payload that matches the `Update` type.
        const { error } = await supabaseClient
          .from('Proyectos')
          .update(payload)
          .eq('id', originalId);
        responseError = error;
      } else { // Adding new project
        const { error } = await supabaseClient
          .from('Proyectos')
          .insert([payload]);
        responseError = error;
      }

      if (responseError) {
        console.error('Supabase error:', responseError);
        setFormError(`Error al guardar proyecto: ${responseError.message}`);
        return false;
      }

      setFormSuccessMessage(`Proyecto "${projectData.name}" ${originalId ? 'actualizado' : 'agregado'} correctamente.`);
      await fetchAdminProjects(); // Refresh admin list
      await onDataMutated();    // Refresh main app list
      setAdminView('list');
      setProjectToEdit(null);
      return true;

    } catch (e: any) {
      console.error('Unexpected error submitting form:', e);
      setFormError(`Error inesperado: ${e.message}`);
      return false;
    } finally {
      setFormSubmitting(false);
    }
  };


  if (!isLoggedIn || adminView === 'login') {
    return (
      <div className="admin-login-view content-view-card" role="main" aria-labelledby="admin-login-heading">
        <h2 id="admin-login-heading">Acceso Administrador</h2>
        <p>
            Ingrese las credenciales de administrador.
        </p>
        {loginError && <p className="admin-message error-message" role="alert">{loginError}</p>}
        <form onSubmit={handleAdminLogin} className="admin-form">
          <div className="form-group">
            <label htmlFor="loginUsername">Usuario:</label>
            <input type="text" id="loginUsername" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required autoComplete="username"/>
          </div>
          <div className="form-group">
            <label htmlFor="loginPassword">Contraseña:</label>
            <input type="password" id="loginPassword" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password"/>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-button primary">Ingresar</button>
            <button type="button" onClick={onBackToApp} className="admin-button secondary">Volver a la App</button>
          </div>
        </form>
      </div>
    );
  }

  if (adminView === 'list') {
    return (
      <div className="admin-list-view content-view-card" role="main" aria-labelledby="admin-projects-heading">
        <div className="admin-panel-header">
            <h2 id="admin-projects-heading">Gestión de Proyectos</h2>
            <button onClick={handleLogout} className="admin-button secondary logout-button">Salir del Panel</button>
        </div>

        {adminProjectsError && <p className="admin-message error-message" role="alert">{adminProjectsError}</p>}
        {formSuccessMessage && <p className="admin-message success-message" role="alert">{formSuccessMessage}</p>}
        
        <button onClick={handleAddNewProjectClick} className="admin-button primary add-new-project-button">
          + Agregar Nuevo Proyecto
        </button>

        {isLoadingAdminProjects ? (
          <p>Cargando proyectos...</p>
        ) : adminProjects.length === 0 && !adminProjectsError ? (
          <p>No hay proyectos para mostrar.</p>
        ) : (
          <table className="admin-projects-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Descripción Corta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {adminProjects.map(project => (
                <tr key={project.id}>
                  <td>{project.id}</td>
                  <td>{project.name}</td>
                  <td>{project.description}</td>
                  <td>
                    <button onClick={() => handleEditProjectClick(project)} className="admin-button edit-button">
                      Editar
                    </button>
                    {/* Consider adding Delete button here later */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (adminView === 'form') {
    return (
      <ProjectForm
        initialProject={projectToEdit}
        onSubmit={handleProjectFormSubmit}
        onCancel={handleFormCancel}
        isSubmitting={formSubmitting}
        formError={formError}
        supabaseClient={supabaseClient} 
      />
    );
  }
  
  return null; // Should not reach here
};

export default AdminPanel;