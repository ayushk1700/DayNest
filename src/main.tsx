import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Dashboard } from './dashboard/Dashboard';
import './ui/tokens.css';
import './ui/uicons.css';
import './dashboard/dashboard.css';
import { dashboardStore } from './state/store';
void dashboardStore.start();
const root = document.getElementById('root');
if (!root) throw new Error('Dashboard mounting element is missing.');
createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <Dashboard />
    </MotionConfig>
  </StrictMode>,
);
