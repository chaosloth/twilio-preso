import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {/* Page views (Analytics) and real-device Core Web Vitals (Speed Insights)
        for the audience app. Inert outside Vercel — the scripts are served by
        the deployment, so local dev sends nothing. The `/react` entry points,
        not `/next`: this is a Vite app with no Next router. */}
    <Analytics />
    <SpeedInsights />
  </>
);
