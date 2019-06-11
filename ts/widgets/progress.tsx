/**
 * Progress bar widget.
 */

import * as cx from "classnames";
import { h } from "preact";

interface Props {
  progress: number;
  className?: string;
  [key: string]: any;
}

export default function({ progress, className, sending, children, ...props }: Props): JSX.Element {
  progress = Math.floor(progress);
  progress = Math.max(0, Math.min(progress, 100));
  const cls = cx("progress", className, { "progress-sending": sending });
  const transform = `translateX(${-(100-progress)}%)`
  return (
    <div class={cls} {...props}>
      <div style={{ transform }} class="progress-background"></div>
      <div class="progress-text">{children}</div>
    </div>
  );
}
