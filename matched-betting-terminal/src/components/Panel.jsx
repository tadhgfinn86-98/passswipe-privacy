import React, { forwardRef } from 'react';

/**
 * A bordered terminal panel with a header strip, an optional keyboard-shortcut
 * hint and a tools area on the right.
 */
const Panel = forwardRef(function Panel(
  { title, hotkey, tools, children, className = '', flush = false, ...rest },
  ref,
) {
  return (
    <section ref={ref} className={`panel ${className}`} tabIndex={-1} {...rest}>
      <header className="panel-head">
        <span className="panel-title">
          {title}
          {hotkey ? <span className="panel-key">{hotkey}</span> : null}
        </span>
        {tools ? <div className="panel-tools">{tools}</div> : null}
      </header>
      <div className={`panel-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
});

export default Panel;
