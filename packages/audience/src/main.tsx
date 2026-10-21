import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {/* Page views and Web Vitals for the audience app. Inert outside Vercel —
        the script is served by the deployment, so local dev sends nothing. */}
    <Analytics />
  </>
);
