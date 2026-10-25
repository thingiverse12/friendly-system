import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';
import { Mascot } from '../components/Mascot';

export function NotFound() {
  useDocumentTitle('Sidan hittades inte');
  return (
    <div className="notfound">
      <Mascot variant="face" size={160} className="notfound__mascot" decorative={false} title="Sparly-hunden letar efter sidan" />
      <h1>Sidan finns inte</h1>
      <p>Länken kanske är gammal eller så har sidan flyttats. Dina sparmål väntar på dig.</p>
      <Link to="/" className="btn btn--primary">
        Till startsidan
      </Link>
    </div>
  );
}
