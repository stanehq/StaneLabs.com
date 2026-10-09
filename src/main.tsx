import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
const element = document.getElementById('root')!;
const app = <React.StrictMode><App path={window.location.pathname} /></React.StrictMode>;
if (element.childNodes.length > 0) hydrateRoot(element, app); else createRoot(element).render(app);
