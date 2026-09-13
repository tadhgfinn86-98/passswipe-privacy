import React, { forwardRef } from 'react';

/**
 * Surface primitive: Charcoal fill, 8px radius, hairline inset ring — no drop
 * shadow. Header carries the title, an optional hotkey hint and tools.
 */
const Card = forwardRef(function Card(
  { title, hotkey, tools, children, className = '', bodyClassName = '', titleSize = '', ...rest },
  ref,
) {
  return (
    <section ref={ref} className={`card ${className}`} tabIndex={-1} {...rest}>
      {title ? (
        <header className="card-head">
          <h2 className={`card-title ${titleSize}`}>{title}</h2>
          <div className="card-tools">
            {tools}
            {hotkey ? <span className="kbd-hint">{hotkey}</span> : null}
          </div>
        </header>
      ) : null}
      <div className={`card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
});

export default Card;
