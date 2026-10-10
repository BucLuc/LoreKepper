"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Feedback } from "./feedback";
import { Icon } from "./icon";
import { Modal } from "./vault-ui";
export function AccountMenu() {
  const [open, setOpen] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [profileName, setProfileName] = useState(""),
    [guest, setGuest] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [guestConfirm, setGuestConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    router = useRouter();
  useEffect(() => {
    try {
      const db = supabase();
      let active = true;
      let revision = 0;
      const refresh = () => {
        const current = ++revision;
        void db.auth.getUser().then(async ({ data }) => {
          if (!active || current !== revision) return;
          setSignedIn(!!data.user);
          setGuest(!!data.user?.is_anonymous);
          if (!data.user) { setProfileName(""); return; }
          const profile = await db.from("profiles").select("name").eq("id", data.user.id).single();
          if (!active || current !== revision) return;
          setProfileName((profile.data as {name:string} | null)?.name || data.user.user_metadata.name || "Chronicler");
        }).catch(() => {
          if (!active || current !== revision) return;
          setSignedIn(false);
          setGuest(false);
          setProfileName("");
        });
      };
      refresh();
      const {
        data: { subscription },
      } = db.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          revision++;
          setSignedIn(false);
          setGuest(false);
          setProfileName("");
        } else refresh();
      });
      window.addEventListener("lore-profile-updated", refresh);
      return () => { active = false; subscription.unsubscribe(); window.removeEventListener("lore-profile-updated", refresh); };
    } catch {}
  }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const r = await supabase().auth.signOut();
      if (r.error) throw r.error;
      setSignedIn(false);
      setGuest(false);
      setOpen(false);
      setGuestConfirm(false);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="account-menu"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!ref.current?.contains(document.activeElement)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-avatar"
        aria-label="Account options"
        aria-expanded={open}
        aria-controls="account-options"
        onClick={() => setOpen(true)}
      >
        {signedIn ? <span className="account-initial" aria-hidden="true">{Array.from(profileName.trim())[0] || "C"}</span> : <Icon name="user" />}
        <span className="avatar-status" />
      </button>
      {open && (
        <div
          id="account-options"
          className="account-popover"
          onBlur={(e) => {
            if (
              !e.currentTarget.contains(e.relatedTarget) &&
              e.relatedTarget !== trigger.current
            )
              setOpen(false);
          }}
        >
          <div className="account-caption">
            <span className="eyebrow">
              {!signedIn ? "WELCOME, CHRONICLER" : guest ? "GUEST CHRONICLER" : "YOUR CHAMBERS"}
            </span>
            <span>
              {signedIn ? "Make yourself at home." : "The archives await."}
            </span>
          </div>
          {signedIn ? (
            <>
              <Link href="/profile" onClick={() => setOpen(false)}>
                <Icon name="user" />
                Your profile
                <Icon name="chevron" />
              </Link>
              {guest && (
                <Link href="/profile" onClick={() => setOpen(false)}>
                  <Icon name="shield" />
                  Keep your guest account
                </Link>
              )}
              <button
                disabled={busy}
                onClick={
                  guest
                    ? () => {
                        setOpen(false);
                        setGuestConfirm(true);
                      }
                    : logout
                }
              >
                <Icon name="logout" />
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}>
              <Icon name="user" />
              Login
              <Icon name="chevron" />
            </Link>
          )}
          {error && <Feedback error onDismiss={()=>setError("")}>{error}</Feedback>}
        </div>
      )}
      <Modal
        open={guestConfirm}
        title="Keep your story before you go."
        onClose={() => {
          if (!busy) setGuestConfirm(false);
        }}
      >
        <p className="v-muted">
          Signing out loses access to this guest account. Upgrade first to keep
          your collections and favorites.
        </p>
        {error && (
          <Feedback error onDismiss={()=>setError("")}>{error}</Feedback>
        )}
        <div className="v-form-actions">
          <button className="v-button" disabled={busy} onClick={logout}>
            Sign out anyway
          </button>
          <Link
            className="v-button v-primary"
            href="/profile"
            onClick={() => setGuestConfirm(false)}
          >
            <Icon name="shield" />
            Keep my account
          </Link>
        </div>
      </Modal>
    </div>
  );
}
