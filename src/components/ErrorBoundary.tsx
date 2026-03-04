import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    private handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            const title = this.props.fallbackTitle ?? 'Bu bölüm';

            return (
                <div className="glass-panel rounded-2xl p-6 text-center space-y-3 my-4">
                    <p className="text-sm text-slate-300">
                        {title} yüklenirken bir hata oluştu.
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="px-4 py-2 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400 hover:text-black transition-colors text-sm font-semibold"
                    >
                        Tekrar Dene
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
