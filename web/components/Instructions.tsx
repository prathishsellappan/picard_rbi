// The participant's briefing, highlighted so it stands out from the working panels: a saffron-tinted
// box with a saffron edge (red in the dark theme, the theme's accent). Every participant sees the
// same panel; only the text differs, and by default it is the same for everyone with the same role.
export function Instructions({ text }: { text: string }) {
  return (
    <section
      aria-labelledby="instructions-title"
      className="fade-up rounded-xl border border-saffron/40 border-l-4 border-l-saffron bg-saffron-tint p-[14px]"
    >
      <div className="mb-2 flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-saffron-deep"
          aria-hidden
        >
          <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
          <path d="M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
          <path d="M9 12h6M9 16h4" />
        </svg>
        <h2 id="instructions-title" className="text-[15px] font-semibold text-ink">
          Your instructions
        </h2>
        <span className="ml-auto rounded-[6px] border border-saffron/40 bg-card px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-saffron-deep">
          From the organizer
        </span>
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{text || "No instructions yet."}</p>
    </section>
  );
}
