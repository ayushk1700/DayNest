import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { PdfStudio } from './PdfStudioCore';
import '../ui/tokens.css';
import '../ui/uicons.css';
import 'pdfjs-dist/web/pdf_viewer.css';
import './pdf.css';

const root = document.getElementById('root');
if (!root) throw new Error('PDF Studio mounting element is missing.');
createRoot(root).render(<StrictMode><MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}><PdfStudio /></MotionConfig></StrictMode>);
