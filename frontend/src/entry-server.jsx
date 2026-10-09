import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import './styles.css';
export function render() {
  return renderToString(<App />);
}