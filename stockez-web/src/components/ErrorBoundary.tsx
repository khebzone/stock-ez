import React from 'react';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32, margin: 24, borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fca5a5',
          fontFamily: 'monospace',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#dc2626', marginBottom: 8 }}>
            Page Error
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, color: '#7f1d1d' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
