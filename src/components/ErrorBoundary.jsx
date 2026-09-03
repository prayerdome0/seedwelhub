import { Component } from 'react';
import { WATERMARK_LOGO } from '../assets';

// Global React Error Boundary. Catches unexpected crashes so users never see a
// blank screen or an internal stack trace.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log internally for debugging only — never displayed to users.
    console.error('[SeedwelHub] Uncaught error:', error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <img loading="lazy" decoding="async" src={WATERMARK_LOGO} alt="Seedwel Hub" style={{ height: 56, marginBottom: 16 }} />
          <div className="error-boundary__icon" aria-hidden="true">⚠️</div>
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__msg">
            We couldn't load this page. Please try again.
          </p>
          <div className="error-boundary__actions">
            <button type="button" className="btn btn--primary" onClick={this.handleTryAgain}>
              Try Again
            </button>
            <button type="button" className="btn btn--secondary" onClick={this.handleGoHome}>
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
