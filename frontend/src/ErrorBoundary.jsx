import { Component } from 'react';
import ErrorState from './components/ui/ErrorState/ErrorState';

/**
 * Route-level error boundary. A page can never white-screen: any render
 * failure is caught and replaced with a recoverable error state.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
      errorId: `ERR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null, errorId: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This page could not be displayed"
          description="The error was contained to this view. Retrying reloads the failed section."
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
