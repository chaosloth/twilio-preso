import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NotesApp } from './notes/NotesApp';

const isNotesRoute = window.location.pathname === '/notes';

createRoot(document.getElementById('root')!).render(
  isNotesRoute ? <NotesApp /> : <App />
);
