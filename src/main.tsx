import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from './dashboard/Dashboard';
import './ui/tokens.css';
import './dashboard/dashboard.css';
import { dashboardStore } from './state/store';
void dashboardStore.start();
const root = document.getElementById('root');
if (!root)
    throw new Error('Dashboard mounting element is missing.');
createRoot(root).render(<StrictMode><Dashboard /></StrictMode>);
