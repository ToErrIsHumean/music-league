"use client";

export default function GlobalError({ reset }) {
  return (
    <div className="archive-page-shell">
      <section className="archive-empty-state">
        <p className="archive-empty-kicker">Archive unavailable</p>
        <h1 className="archive-empty-title">We hit a snag loading the archive.</h1>
        <p className="archive-empty-body">
          Try the route again. If the problem persists, the archive data layer
          likely needs attention.
        </p>
        <button className="archive-reset-button" type="button" onClick={() => reset()}>
          Retry
        </button>
      </section>
    </div>
  );
}
