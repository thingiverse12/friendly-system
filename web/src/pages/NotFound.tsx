import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';
import { EmptyIllustration } from '../components/Illustrations';

export function NotFound() {
  useDocumentTitle('Sidan hittades inte');
  return (
    <div className="notfound">
      <EmptyIllustration variant="goal" />
      <h1>Sidan finns inte</h1>
      <p>Länken kanske är gammal eller så har sidan flyttats. Dina sparmål väntar på dig.</p>
      <Link to="/" className="btn btn--primary">
        Till startsidan
      </Link>
    </div>
  );
}
