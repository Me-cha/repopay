import { BrandEmblem } from '../components/common/Icons.js';
import { useRouter } from '../router/Router.js';

export function NotFoundPage() {
  const { navigate } = useRouter();

  return (
    <div className="c2-signin-viewport">
      <div className="c2-signin-ambient" aria-hidden="true" />
      <main className="c2-signin-card">
        <div className="c2-signin-emblem">
          <BrandEmblem size={44} />
        </div>
        <h1 className="c2-signin-title">Page not found</h1>
        <p className="c2-signin-subtitle">
          The requested workspace route does not exist or has moved.
        </p>
        <button
          type="button"
          className="c2-btn c2-btn-primary c2-signin-btn"
          onClick={() => { navigate('/dashboard'); }}
        >
          Return to Dashboard
        </button>
      </main>
    </div>
  );
}
