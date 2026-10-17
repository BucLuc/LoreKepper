"use client";
import { useEffect, useId, useRef } from "react";
import { Icon } from "./icon";
export function Modal({
  open,
  title,
  onClose,
  children,
  wide=false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?:boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    label = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
      dialog
        ?.querySelector<HTMLElement>(
          'input:not([readonly]):not([type="file"]),textarea,select',
        )
        ?.focus();
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`vault-modal ${wide?"vault-modal-wide":""}`}
      aria-labelledby={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">THE KEEPER’S SEAL</span>
          <h2 id={label}>{title}</h2>
        </div>
        <button
          type="button"
          className="v-icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function VaultMonument({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`vault-monument ${compact ? "is-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="monument-halo" />
      <div className="monument-arch">
        <span className="monument-star">✦</span>
        <div className="monument-book">
          <Icon name="book" width="95" height="95" />
          <span>
            LORE
            <br />
            KEEPER
          </span>
          <i>VOL. ∞</i>
        </div>
        <span className="monument-orbit orbit-one">✧</span>
        <span className="monument-orbit orbit-two">✦</span>
      </div>
      <div className="monument-plinth" />
      <span className="monument-caption">
        WORDS WORTH KEEPING · LEGENDS WORTH SHARING
      </span>
    </div>
  );
}
// Shimmering placeholders for content that is still on its way. The label is read
// to screen readers only; nothing visible says "loading".
export function SkeletonLines({
  lines = 3,
  label,
  className = "",
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`sk-lines ${className}`} aria-busy="true">
      {label && (
        <span className="sr-only" role="status">
          {label}
        </span>
      )}
      {Array.from({ length: lines }, (_, i) => (
        <div className="skeleton-bar" aria-hidden="true" key={i} />
      ))}
    </div>
  );
}
export function SkeletonCards({
  count = 3,
  label,
  className = "",
  seal = true,
}: {
  count?: number;
  label?: string;
  className?: string;
  seal?: boolean;
}) {
  return (
    <>
      {label && (
        <span className="sr-only" role="status">
          {label}
        </span>
      )}
      {Array.from({ length: count }, (_, i) => (
        <div className={`sk-card ${className}`} aria-hidden="true" key={i}>
          {seal && <div className="skeleton-seal" />}
          <div className="skeleton-bar sk-card-title" />
          <div className="skeleton-bar" />
          <div className="skeleton-bar sk-short" />
        </div>
      ))}
    </>
  );
}
export function ArchiveSkeleton({
  story = false,
  page = "home",
}: {
  story?: boolean;
  page?: string;
}) {
  const lines = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="skeleton-bar sk-line" key={i} />
      ))}
    </>
  );
  const cards = (
    <div className="skeleton-cards">
      {[0, 1, 2].map((i) => (
        <div className="skeleton-paper" key={i}>
          <div className="skeleton-seal" />
          <div className="skeleton-bar sk-small" />
          <div className="skeleton-bar sk-line" />
        </div>
      ))}
    </div>
  );
  const title = (
    <>
      <div className="skeleton-bar sk-title" />
      <div className="skeleton-bar sk-subtitle" />
    </>
  );
  return (
    <main
      id="main"
      className={`vault-skeleton ${story ? "story-skeleton" : ""} ${["collection", "favorites", "invite"].includes(page) ? "skeleton-collection" : ""}`}
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        {story ? "Unrolling the legend…" : page === "lobby" ? "Opening the story…" : "Opening the archives…"}
      </span>
      <div aria-hidden="true">
        {page === "login" ? (
          <div className="skeleton-auth">
            <div>
              {title}
              <div className="skeleton-seal" />
            </div>
            <div className="skeleton-paper">
              <div className="skeleton-bar sk-small" />
              {lines}
              <div className="skeleton-bar sk-option" />
            </div>
          </div>
        ) : (
          <>
            <div className="skeleton-bar sk-crumb" />
            {page === "lobby" ? (
              <div className="sk-lobby">
                <div className="skeleton-bar sk-title" />
                <div className="skeleton-bar sk-subtitle" />
                <div className="sk-lobby-grid">
                  <aside>
                    <SkeletonCards count={3} className="is-row" />
                  </aside>
                  <section className="sk-lobby-cards">
                    <SkeletonCards count={10} seal={false} />
                  </section>
                </div>
              </div>
            ) : page === "profile" ? (
              <div className="sk-identity">
                <div className="skeleton-seal" />
                <div>{title}</div>
              </div>
            ) : (
              title
            )}
            {page === "lobby" ? null : story ? (
              <div className="skeleton-reader">
                <aside>
                  <div className="skeleton-bar sk-small" />
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div className="skeleton-bar sk-option" key={i} />
                  ))}
                </aside>
                <div className="skeleton-paper">
                  <div className="skeleton-seal" />
                  {lines}
                  {lines}
                </div>
              </div>
            ) : ["settings", "edit", "new"].includes(page) ? (
              <div className="skeleton-admin">
                <aside>
                  {[0, 1, 2, 3].map((i) => (
                    <div className="skeleton-bar sk-option" key={i} />
                  ))}
                </aside>
                <section>
                  <div className="skeleton-paper">{lines}</div>
                  <div className="skeleton-paper">{lines}</div>
                </section>
              </div>
            ) : page === "invite" ? (
              <div className="skeleton-seal" />
            ) : (
              cards
            )}
          </>
        )}
      </div>
    </main>
  );
}
