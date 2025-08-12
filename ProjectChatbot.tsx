import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';
import type { Project } from './ProjectDetail';
import './ProjectChatbot.css';

interface ProjectChatbotProps {
  project: Project;
  isVisible: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

const WHATSAPP_PHONE_NUMBER = "+5492612765652"; // Centralized WhatsApp number

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
);

const CloseIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const ProjectChatbot: React.FC<ProjectChatbotProps> = ({ project, isVisible }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (process.env.API_KEY) {
      setApiKeyAvailable(true);
    } else {
      console.warn("Gemini API Key (process.env.API_KEY) no está configurada. El chatbot estará deshabilitado.");
      setApiKeyAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!project || !apiKeyAvailable || !isVisible) return;

    const systemInstruction = `
      Eres un asistente virtual para el proyecto inmobiliario "${project.name}".
      Información disponible sobre "${project.name}":
      - Nombre: ${project.name}
      - Descripción General: ${project.description}
      - Detalles Adicionales: ${project.details}
      - Coordenadas: ${project.coordinates.join(', ')}
      - Media: ${project.media.length > 0 ? `${project.media.length} imágenes/videos disponibles.` : 'No hay información multimedia específica.'}

      Tu ÚNICA tarea es responder preguntas BASÁNDOTE EXCLUSIVAMENTE en la información anterior sobre "${project.name}".
      Si una pregunta del usuario NO PUEDE SER RESPONDIDA usando la información anterior, responde ÚNICA Y EXACTAMENTE con la frase: "NOINFO". No añadas NADA MÁS que "NOINFO".
      Si SÍ PUEDES responder, hazlo de forma concisa, amigable y como una persona.
      Al iniciar la conversación por primera vez (cuando el usuario envía "Hola" o similar), saluda al usuario y pregúntale en qué puedes ayudarle sobre el proyecto "${project.name}".
    `;
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! }); 
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
      });
      setChatSession(chat);
      setMessages([]); 

      setIsLoading(true);
      // Send an initial message to trigger the bot's greeting
      chat.sendMessageStream({ message: "Hola" }) 
        .then(async (stream) => {
          let botResponseText = "";
          const initialBotMessageId = self.crypto.randomUUID();
           setMessages(prev => [...prev, { id: initialBotMessageId, text: "", sender: 'bot' }]);

          for await (const chunk of stream) {
            botResponseText += chunk.text;
            setMessages(prev => prev.map(msg => 
                msg.id === initialBotMessageId ? {...msg, text: botResponseText } : msg
            ));
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Error with initial greeting:", err);
          setError("No se pudo iniciar el chat. Intenta más tarde.");
          setIsLoading(false);
        });

    } catch (e: any) {
        console.error("Failed to initialize GoogleGenAI or chat session:", e);
        setError("No se pudo inicializar el servicio de chat.");
        setApiKeyAvailable(false); 
    }
  }, [project, apiKeyAvailable, isVisible]); 

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !chatSession) return;

    const originalUserQuestion = userInput; // Capture the user's question before clearing
    const newUserMessage: ChatMessage = {
      id: self.crypto.randomUUID(),
      text: originalUserQuestion,
      sender: 'user',
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
      const stream = await chatSession.sendMessageStream({ message: originalUserQuestion });
      let botResponseText = "";
      const botMessageId = self.crypto.randomUUID();
      
      setMessages(prevMessages => [...prevMessages, { id: botMessageId, text: "", sender: 'bot' }]);

      for await (const chunk of stream) {
        botResponseText += chunk.text;
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === botMessageId ? { ...msg, text: botResponseText } : msg
          )
        );
      }
      
      // Process the complete bot response
      const outOfContextTriggerExact = "NOINFO";
      if (botResponseText.trim() === outOfContextTriggerExact) {
        const whatsappMessage = `Hola, tengo una pregunta sobre el proyecto "${project.name}": ${originalUserQuestion}`;
        const encodedWhatsappMessage = encodeURIComponent(whatsappMessage);
        const whatsappLink = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodedWhatsappMessage}`;
        
        const newBotText = `No tengo información específica sobre eso en este proyecto. <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="chatbot-whatsapp-link">¿Quieres preguntar por WhatsApp?</a>`;
        
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === botMessageId ? { ...msg, text: newBotText } : msg
          )
        );
      }
      // If not "NOINFO", the message is already set with botResponseText by the streaming update.

    } catch (err: any) {
      console.error('Error sending message to Gemini:', err);
      setError('Hubo un error al obtener la respuesta. Inténtalo de nuevo.');
      setMessages(prev => [...prev, {id: self.crypto.randomUUID(), text: "Lo siento, no pude procesar tu solicitud.", sender: 'bot'}]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible || !apiKeyAvailable) {
    return null; 
  }

  return (
    <>
      <button
        className="project-chatbot-fab"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Cerrar chat del proyecto' : 'Abrir chat del proyecto'}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {isOpen && (
        <div className="project-chatbot-window" role="dialog" aria-labelledby="chatbot-heading">
          <header className="project-chatbot-header">
            <h2 id="chatbot-heading">Chat: {project.name}</h2>
            <button onClick={() => setIsOpen(false)} aria-label="Cerrar chat">
              <CloseIcon />
            </button>
          </header>
          <div className="project-chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message-bubble ${msg.sender}`}>
                {msg.sender === 'bot' && msg.text.includes('<a href') ? (
                  <p dangerouslySetInnerHTML={{ __html: msg.text }} />
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            ))}
            {isLoading && messages.length > 0 && messages[messages.length-1]?.sender === 'user' && ( 
              <div className="message-bubble bot">
                <p className="loading-dots"><span>.</span><span>.</span><span>.</span></p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {error && <p className="project-chatbot-error" role="alert">{error}</p>}
          <form onSubmit={handleSendMessage} className="project-chatbot-input-form">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              aria-label="Escribe tu pregunta para el chatbot"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !userInput.trim()} aria-label="Enviar mensaje">
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ProjectChatbot;