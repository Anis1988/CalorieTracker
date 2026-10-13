import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { followThemeInBars } from './lib/native';

followThemeInBars();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
