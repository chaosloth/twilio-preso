import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NotesApp } from './notes/NotesApp';

const isNotesRoute = window.location.pathname === '/notes';
/**
 * The notes window is told its session in the URL rather than reading a shared
 * localStorage key: two presenter windows for different sessions in one browser
 * must not end up driving each other's slides.
 */
const sessionId = new URLSearchParams(window.location.search).get('sessionId') ?? '';

createRoot(document.getElementById('root')!).render(
  isNotesRoute ? <NotesApp sessionId={sessionId} /> : <App />
);
