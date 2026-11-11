import { Component, type ReactNode } from 'react';
export class SceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() {
    if (this.state.failed && this.props.fallback !== undefined) return this.props.fallback;
    if (this.state.failed) return <div className="render-error" role="alert">三维画面未能显示。请检查浏览器的图形加速设置。<button onClick={() => this.setState({ failed: false })}>重试画面</button></div>;
    return this.props.children;
  }
}
