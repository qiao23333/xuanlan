import React from 'react';

/**
 * 结果墙级别的错误边界。
 *
 * 评审指出：任一 adapter / renderer 抛异常会整页白屏。这里把每个体系卡
 * 的渲染失败收敛到局部降级——"该体系暂不可用"，其余体系照常显示。
 * 这是工程健壮性的基本盘，也是面试会问"你的错误策略是什么"时的实证。
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { err: Error | null }
> {
  override state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  override componentDidCatch(err: Error) {
    // 仅本地日志，不向外发送任何数据（产品无后端、无遥测）。
    console.error('[ErrorBoundary]', this.props.label ?? '模块', err);
  }

  override render() {
    if (this.state.err) {
      return (
        <div className="err-boundary" role="alert">
          <span className="eb-icon">⚠</span>
          <div>
            <b>{this.props.label ?? '该模块'}暂不可用</b>
            <p>{this.state.err.message}</p>
            <small>其他体系不受影响。这是本地渲染异常，刷新页面即可重试。</small>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
