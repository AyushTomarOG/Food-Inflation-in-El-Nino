import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
hydrateRoot(document.getElementById('root'), <App />);