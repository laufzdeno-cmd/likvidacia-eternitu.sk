import { emailLink, phoneLink, site } from '@/src/content/site';
import './private-action.css';

export default function PrivateActionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="private-action-shell">
      <header className="private-action-header">
        <a href="/" aria-label="ASTANA – domovská stránka">
          <img src="/assets/astana-logo-dark.png" alt="ASTANA" width="176" height="59" />
        </a>
        <a href={phoneLink}>{site.phone}</a>
      </header>
      {children}
      <footer className="private-action-footer">
        <strong>{site.legalName}</strong>
        <span>Bezpečná likvidácia azbestu a eternitu</span>
        <a href={emailLink}>{site.email}</a>
      </footer>
    </div>
  );
}
