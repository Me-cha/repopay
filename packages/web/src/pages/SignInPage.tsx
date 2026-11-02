import { useEffect, useState } from 'react';
import {
  BrandEmblem,
  IconGitPullRequest,
  IconPayouts,
  IconShieldCheck,
  Spinner,
} from '../components/common/Icons.js';
import { useAuth } from '../context/AuthContext.js';
import { useRouter } from '../router/Router.js';

function GithubMark({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function MonumentGraphic() {
  return (
    <svg
      viewBox="0 0 680 340"
      className="c2-auth-monument-svg"
      fill="none"
      aria-hidden="true"
    >
      {/* Subtle constellation accents in upper-right dark void */}
      <circle cx="548" cy="44" r="1.2" fill="#FFFFFF" fillOpacity="0.24" />
      <circle cx="592" cy="68" r="1.5" fill="#FFFFFF" fillOpacity="0.18" />
      <circle cx="624" cy="36" r="1" fill="#FFFFFF" fillOpacity="0.28" />
      <circle cx="512" cy="82" r="1" fill="#FFFFFF" fillOpacity="0.15" />

      {/* Diagonal architectural light-beam ribbons sweeping from top-right */}
      <polygon
        points="680,10 680,44 378,340 356,340"
        fill="#8CA397"
        fillOpacity="0.26"
      />
      <polygon
        points="680,52 680,63 402,340 392,340"
        fill="#B5E4CA"
        fillOpacity="0.22"
      />
      <polygon
        points="680,0 648,0 462,184 494,184"
        fill="#FFFFFF"
        fillOpacity="0.04"
      />

      {/* Monumental Swiss Modernist RepoPay Monomark (matches BrandEmblem) */}
      <rect
        x="154"
        y="38"
        width="240"
        height="240"
        rx="48"
        fill="#14171A"
        stroke="#252A30"
        strokeWidth="2"
      />
      <g transform="translate(154, 38) scale(0.234375)">
        {/* Subtle emerald ambient aura behind green leg */}
        <polygon
          points="542,490 681,716 590,716 490,551"
          fill="#4DFD9F"
          opacity="0.25"
          filter="blur(18px)"
        />
        {/* Architectural Chamfered White 'P' Monomark */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 340 716 L 340 307 L 586 307 L 654 375 L 654 482 L 595 541 L 542 488 L 490 541 L 414 541 L 414 716 Z M 414 382 L 550 382 L 580 412 L 580 448 L 550 478 L 414 478 Z"
          fill="#FFFFFF"
        />
        {/* Electric Mint Diagonal 'R' Leg */}
        <polygon points="542,490 681,716 590,716 490,551" fill="#4DFD9F" />
      </g>
    </svg>
  );
}

export function SignInPage() {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="c2-auth-split">
      {/* Left Column: Clean GitHub-Only Sign-In Surface on #F4F4F4 */}
      <section className="c2-auth-left" aria-label="GitHub authentication">
        <div className="c2-auth-form-col">
          <div className="c2-auth-brand">
            <BrandEmblem size={40} />
            <div className="c2-brand-copy">
              <span className="c2-brand-name">Repopay</span>
              <span className="c2-brand-tag">Escrow Desk</span>
            </div>
          </div>

          <h1 className="c2-auth-heading">Sign in</h1>
          <p className="c2-auth-lead">
            Connect your GitHub identity to access repository escrow analytics, PR verifications, and payout settings.
          </p>

          {/* Clean white read-only scope pods echoing the crisp white field geometry on #F4F4F4 */}
          <div className="c2-auth-scope-group">
            <div className="c2-auth-field-label">Authentication Provider</div>
            <div className="c2-auth-scope-bar">
              <span className="c2-auth-scope-icon">
                <GithubMark size={17} />
              </span>
              <span className="c2-auth-scope-value">GitHub OAuth 2.0 · PKCE</span>
              <span className="c2-auth-scope-tag">Required</span>
            </div>
          </div>

          <div className="c2-auth-scope-group">
            <div className="c2-auth-field-label">Workspace Permissions</div>
            <div className="c2-auth-scope-bar">
              <span className="c2-auth-scope-icon">
                <IconShieldCheck size={18} />
              </span>
              <span className="c2-auth-scope-value">
                Read-only bounties &amp; encrypted payout binding
              </span>
            </div>
          </div>

          {/* Primary Solid Dark Connect GitHub CTA */}
          <div className="c2-auth-cta-wrap">
            {loading ? (
              <div className="c2-auth-loading-btn" role="status">
                <Spinner size={17} />
                <span>Verifying active GitHub session…</span>
              </div>
            ) : (
              <a
                href="/login?returnTo=/dashboard"
                className="c2-auth-submit-btn"
                onClick={() => {
                  setRedirecting(true);
                }}
              >
                {redirecting ? (
                  <>
                    <Spinner size={17} />
                    <span>Redirecting to GitHub…</span>
                  </>
                ) : (
                  <>
                    <GithubMark size={19} />
                    <span>Continue with GitHub</span>
                  </>
                )}
              </a>
            )}
          </div>

          {/* Clean contextual notes matching reference footer cadence */}
          <div className="c2-auth-notes">
            <p className="c2-auth-note-line">
              No email or password is stored. Sessions use HTTP-only encrypted cookies.
            </p>
            <p className="c2-auth-note-strong">
              GitHub-verified repository &amp; contributor access
            </p>
          </div>

          {/* Single crisp GitHub provider emblem pill */}
          <div className="c2-auth-provider-row">
            <a
              href="/login?returnTo=/dashboard"
              className="c2-auth-provider-circle"
              aria-label="Connect GitHub account"
              title="Sign in via GitHub OAuth"
              onClick={() => {
                setRedirecting(true);
              }}
            >
              <GithubMark size={24} />
            </a>
            <span className="c2-auth-provider-caption">
              Single-provider OAuth · Instant redirect to Escrow Overview
            </span>
          </div>
        </div>
      </section>

      {/* Right Column: Obsidian Showcase Panel with 3D Monument & Notched Feature Card */}
      <aside className="c2-auth-right" aria-label="Repopay platform overview">
        <div className="c2-auth-poster">
          {/* Top 3D Faceted Monument + Diagonal Light Streak */}
          <div className="c2-auth-monument-stage">
            <MonumentGraphic />
          </div>

          {/* Middle Welcome Editorial Block */}
          <div className="c2-auth-poster-copy">
            <span className="c2-auth-poster-brand">Repopay</span>
            <h2 className="c2-auth-poster-title">Welcome to Repopay</h2>
            <p className="c2-auth-poster-body">
              Repopay bridges GitHub pull request merges with captured PayPal escrow. Every submission is checked against frozen acceptance criteria and exact commit revisions before funds move.
            </p>
            <p className="c2-auth-poster-highlight">
              Open participation · Exact-cent contributor splits
            </p>
          </div>

          {/* Bottom Charcoal Card with Signature Top-Right Inverted Step Notch */}
          <div className="c2-auth-notch-wrap">
            <div className="c2-auth-notch-card">
              {/* Top-right architectural cutout mask */}
              <div className="c2-auth-notch-cutout" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  className="c2-notch-fillet c2-fillet-left"
                >
                  <path d="M0 0H22V22C22 9.85 12.15 0 0 0Z" fill="#0B0B0D" />
                </svg>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  className="c2-notch-fillet c2-fillet-bottom"
                >
                  <path d="M0 0H22V22C22 9.85 12.15 0 0 0Z" fill="#0B0B0D" />
                </svg>
              </div>

              <h3 className="c2-auth-notch-title">
                Merge qualifying PRs, settle escrow automatically
              </h3>

              <div className="c2-auth-notch-bottom">
                <p className="c2-auth-notch-desc">
                  Captured bounties stay protected in escrow and disburse to linked contributor accounts once merged.
                </p>

                {/* Overlapping protocol capability badges */}
                <div className="c2-auth-badge-stack" aria-hidden="true">
                  <span className="c2-stack-dot is-one">
                    <GithubMark size={16} />
                  </span>
                  <span className="c2-stack-dot is-two">
                    <IconGitPullRequest size={16} />
                  </span>
                  <span className="c2-stack-dot is-three">
                    <IconShieldCheck size={16} />
                  </span>
                  <span className="c2-stack-dot is-four">
                    <IconPayouts size={15} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
