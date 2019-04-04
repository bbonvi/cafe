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

export default function({ progress, className, ...props }: Props): JSX.Element {
  progress = Math.floor(progress);
  progress = Math.max(0, Math.min(progress, 100));
  const cls = cx("progress", className);
  const background = `
    linear-gradient(
      to right,
      #388697 ${progress}%,
      transparent ${progress}%
    )
  `;
  return (
    <div class={cls} style={{ background }} title={`${progress}%`} {...props} />
  );
}
