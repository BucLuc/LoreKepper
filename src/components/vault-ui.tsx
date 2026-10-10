"use client";
import { useEffect, useId, useRef } from "react";
import { Icon } from "./icon";
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
      className="vault-modal"
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
        {story ? "Unrolling the legend…" : "Opening the archives…"}
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
            {page === "profile" ? (
              <div className="sk-identity">
                <div className="skeleton-seal" />
                <div>{title}</div>
              </div>
            ) : (
              title
            )}
            {story ? (
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
