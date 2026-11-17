import { VampireMark } from './components/VampireMark';
import './App.css';

export function App() {
  return (
    <div className="app">
      <header className="masthead">
        <VampireMark className="masthead__mark" size={88} />
        <div>
          <h1 className="masthead__title">Day Walker</h1>
          <p className="masthead__tagline">Every bar near you, sorted by when it closes.</p>
        </div>
      </header>

      <footer className="app__footer">
        <p>
          Bar data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
        </p>
      </footer>
    </div>
  );
}
