import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { MusicExperience } from './MusicExperience';
import { dashboardStore, useDashboard } from '../state/store';
import { canonicalTheme } from '../state/model';
import '../ui/tokens.css';
const root = document.getElementById('root');
if (!root) throw new Error('Immersive music root missing.');
function ImmersivePage() {
  const { document: dashboardDocument } = useDashboard();
  useEffect(() => {
    void dashboardStore.start();
  }, []);
  useEffect(() => {
    if (dashboardDocument?.theme)
      window.document.documentElement.dataset.theme = canonicalTheme(dashboardDocument.theme);
  }, [dashboardDocument?.theme]);
  return <MusicExperience immersive />;
}
createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <ImmersivePage />
    </MotionConfig>
  </StrictMode>,
);
