import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './ui/neighbor.css';

document.documentElement.classList.add('neighbor-edition');

createRoot(document.getElementById('root')!).render(<App />);
