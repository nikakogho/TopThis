import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
export function App() {
  return (
    <main>
      <p className="eyebrow">TOPTHIS</p>
      <h1>Everything beats something. Top this.</h1>
      <p className="tagline">
        A strategic multiplayer card game where every card has its own counters, and the last
        successful play takes the pile.
      </p>
      <p className="status">The table is being dealt. Phase 0 is ready.</p>
    </main>
  );
}
document.title = 'TopThis — Everything beats something. Top this.';
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
