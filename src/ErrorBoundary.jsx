import React from 'react';

// Shows a friendly message instead of a blank page if something crashes.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="state-box">
          <h2>Something went wrong</h2>
          <p>Reload the page to try again.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
