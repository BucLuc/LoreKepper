"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { api, supabase } from "@/lib/supabase";
import { statsFor, type Exhibit, type Message } from "@/lib/archive";
import { validateEntries } from "@/lib/validation";
import {messageDateTimeValue,messageDateTimeTimestamp} from "@/lib/message-datetime";
import { MarkdownEditor } from "./markdown-editor";
import { Feedback } from "./feedback";
import { EntryMenu } from "./entry-menu";
import { ExportOptions } from "./export-options";
import {CollectionExportEntries} from "./collection-export-entries";
import {exportEntries,orderEntries,type CollectionOrder} from "../lib/collection-order";
import {collectionJson,collectionMarkdown} from "../lib/export-collection";
import { CollectionPdfSettings } from "./collection-pdf-settings";
import { presetDesign, type EditionDesign } from "@/lib/edition-design";
import { readerEditions } from "@/lib/reader-editions";
import { exportFilename } from "@/lib/export-name";
import { Hall } from "./hall";
import { Reader } from "./reader";
import { Icon, type IconName } from "./icon";
import { ArchiveSkeleton, Modal, VaultMonument } from "./vault-ui";
type Collection = {
  id: string;
  name: string;
  owner_id: string;
  entries?: { count: number }[];
  members?: { count: number }[];
};
type Member = { user_id: string; profiles: { id: string; name: string } };
type Archive = {
  collection: Collection;
  entries: Exhibit[];
  creators: Record<string, string>;
  members: Member[];
  favorites: { entry_id: string; user_id: string }[];
  invites: { id: string; expires_at: string }[];
};
type DraftMessage = Message & { userId?: string };
type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (blob: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};
export function ArchiveApp({
  mode = "home",
  id,
  token,
}: {
  mode?: string;
  id?: string;
  token?: string;
}) {
  const router = useRouter();
  const [selectedStory,setSelectedStory]=useState<{e:Exhibit;v:Archive}|null>(null);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]),
    [archives, setArchives] = useState<Archive[]>([]),
    [profile, setProfile] = useState(""),
    [invite, setInvite] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [signup, setSignup] = useState(false),
    [title, setTitle] = useState(""),
    [messages, setMessages] = useState<DraftMessage[]>([]);
  const [modal, setModal] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [tab, setTab] = useState("entries"),
    [adminTab, setAdminTab] = useState("general"),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [format, setFormat] = useState<"json" | "md" | "pdf">("pdf"),
    [download, setDownload] = useState<{ url: string; name: string } | null>(
      null,
    ),
    [importFile, setImportFile] = useState<{
      name: string;
      archive: unknown;
      count: number;
    } | null>(null);
  const [pdfEdition,setPdfEdition]=useState("ancientcodex"), [pdfDesign,setPdfDesign]=useState<EditionDesign>(()=>({...presetDesign("ancientcodex"),pages:true,showCover:false,cover:"ancientcodex",endPage:"ancientcodex"}));
  const [exportIds,setExportIds]=useState<Set<string>>(new Set());
  const [pdfTitle,setPdfTitle]=useState("");
  const [exportOrder,setExportOrder]=useState<CollectionOrder>("number");
  const [exportPreviewId,setExportPreviewId]=useState<string|null>(null);
  const [pdfProgress,setPdfProgress]=useState<{story:number;total:number;pages:number;label:string}|null>(null);
  const pdfAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>pdfAbort.current?.abort(),[]);
  async function load(u: User) {
    const home = await api("home");
    setCollections(home.collections);
    setProfile(home.profile.name);
    if (mode === "invite" && token) {
      const joined = await api("accept", { token });
      router.replace(`/collections/${joined.id}`);
      return;
    }
    if (mode === "profile")
      setArchives(
        await Promise.all(
          home.collections.map((c: Collection) =>
            api("collection", { collection: c.id }),
          ),
        ),
      );
    else if (id && !["story", "edit"].includes(mode))
      setArchives([await api("collection", { collection: id })]);
    else if (["story", "edit"].includes(mode) && id) {
      const all: Archive[] = [];
      for (const c of home.collections) {
        const a: Archive = await api("collection", { collection: c.id });
        const entry = a.entries.find((e) => e.id === id);
        if (entry) {
          all.push(a);
          if (mode === "edit") {
            setTitle(entry.title);
            setMessages(entry.messages.map((m) => ({ ...m, content: m.presentation ?? m.content, original: undefined, presentation: undefined, sourceFormat: "markdown" })));
          }
          break;
        }
      }
      setArchives(all);
    }
    if (mode === "new")
      setMessages([
        {
          id: crypto.randomUUID(),
          source: "LoreKeeper",
          author: home.profile.name,
          userId: u.id,
          timestamp: new Date().toISOString(),
          content: "",
          sourceFormat: "markdown",
        },
      ]);
    setUser(u);
  }
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError("");
      }
    });
    try {
      const db = supabase();
      db.auth
        .getUser()
        .then(async ({ data }) => {
          if (!active) return;
          if (!data.user) {
            setUser(null);
            setCollections([]);
            setArchives([]);
            if (!["home", "login"].includes(mode))
              router.replace(
                `/login?next=${encodeURIComponent(window.location.pathname)}`,
              );
            return;
          }
          setUser(data.user);
          await load(data.user);
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
      const {
        data: { subscription },
      } = db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setArchives([]);
          setCollections([]);
          setProfile("");
          setModal("");
          if (!["home", "login"].includes(mode)) router.replace("/");
        } else if (event === "USER_UPDATED" && session) setUser(session.user);
      });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch (e) {
      queueMicrotask(() => {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    }
    // Each route fetches only session-authorized data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, token]);
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download],
  );
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const submit = (fn: () => Promise<void>) => (e: FormEvent) => {
    e.preventDefault();
    void run(fn);
  };
  function nextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^\/(?!\/)/.test(next) && !next.includes("\\") ? next : "/";
  }
  async function authenticate(guest = false) {
    await run(async () => {
      const db = supabase();
      const r = guest
        ? await db.auth.signInAnonymously({
            options: { data: { name: name || "Wandering chronicler" } },
          })
        : signup
          ? await db.auth.signUp({
              email,
              password,
              options: { data: { name: name || "Chronicler" } },
            })
          : await db.auth.signInWithPassword({ email, password });
      if (r.error) throw r.error;
      if (!r.data.session)
        throw new Error(
          "Email sign-up is awaiting confirmation. Check your inbox.",
        );
      router.replace(nextPath());
      router.refresh();
    });
  }
  const a = archives[0],
    admin = a?.collection.owner_id === user?.id,
    entry = a?.entries.find((e) => e.id === id),
    ownEntry = entry && a?.creators[entry.id] === user?.id;
  const chosenExports=a?exportEntries(a.entries,exportIds,exportOrder):[];
  const exportPreview=a?.entries.find(e=>e.id===exportPreviewId)??chosenExports[0];
  const button = (
    label: string,
    icon: IconName,
    click: () => void,
    primary = false,
  ) => (
    <button
      type="button"
      className={primary ? "v-button v-primary" : "v-button"}
      disabled={busy}
      onClick={click}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
  const field = (
    label: string,
    value: string,
    set: (value: string) => void,
    type = "text",
  ) => (
    <label className="v-field">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        required
        autoFocus={["create", "rename", "profileName"].includes(modal)}
        maxLength={type === "password" ? 128 : 120}
        minLength={type === "password" ? 8 : undefined}
        autoComplete={
          type === "password"
            ? signup
              ? "new-password"
              : "current-password"
            : type === "email"
              ? "email"
              : undefined
        }
      />
    </label>
  );
  const feedback = <>{error && <Feedback error onDismiss={()=>setError("")}>{error}</Feedback>}{notice && <Feedback onDismiss={()=>setNotice("")}>{notice}</Feedback>}</>;
  const entryActions = (e:Exhibit,v:Archive) => v.creators[e.id]===user?.id ? <EntryMenu title={e.title} onEdit={()=>router.push(`/stories/${e.id}/edit`)} onDelete={()=>{setSelectedStory({e,v});openModal("deleteEntry");}}/> : null;
  const back = a ? (
    <Link className="v-back" href={`/collections/${a.collection.id}`}>
      <span>←</span>
      {a.collection.name}
    </Link>
  ) : (
    <Link className="v-back" href="/">
      ← Your collections
    </Link>
  );
  function openModal(value: string) {
    setError("");
    setConfirmation("");
    if(value==="export"){setPdfTitle(a?.collection.name??"");setExportIds(new Set(a?.entries.map(e=>e.id)??[]));setExportOrder("number");setExportPreviewId(a?orderEntries(a.entries)[0]?.id??null:null);setFormat("pdf");}
    setModal(value);
    if (value === "rename") setName(a?.collection.name || "");
    if (value === "profileName") setName(profile);
    if (value === "credentials") {
      setEmail(user?.is_anonymous ? "" : user?.email || "");
      setPassword("");
    }
    if (value === "create") setName("");
    if (value === "export") setDownload(null);
    if (value === "import") setImportFile(null);
  }
  const heading = (
    eyebrow: string,
    title: string,
    description: string,
    icon: IconName = "crown",
  ) => (
    <header className="v-page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="v-heading-seal" aria-hidden="true">
        <Icon name={icon} width="38" height="38" />
      </div>
    </header>
  );
  async function exportCollection() {
    await run(async () => {
      if (!a || !chosenExports.length) return;
      if (format === "pdf") {
        // Choose the destination before rendering, while the click has user activation.
        const picker = (window as SaveWindow).showSaveFilePicker;
        const handle = picker ? await picker.call(window, {
          suggestedName: exportFilename(pdfTitle.trim()||a.collection.name, "pdf", readerEditions.find(e => e.id === pdfEdition)?.name),
          types: [{description: "A4 collection PDF", accept: {"application/pdf": [".pdf"]}}],
        }) : null;
        const controller=new AbortController();pdfAbort.current=controller;setPdfProgress({story:0,total:chosenExports.length,pages:0,label:"Loading selected entries"});
        try {
          const latest=await api("collection",{collection:a.collection.id},controller.signal);
          const {exportCollectionPdf}=await import("@/lib/export-collection-pdf");
          const result=await exportCollectionPdf({name:pdfTitle.trim()||latest.collection.name,entries:exportEntries(latest.entries,exportIds,exportOrder),edition:pdfEdition,font:pdfDesign.font,design:{...pdfDesign,pages:true},signal:controller.signal,onProgress:setPdfProgress});
          if (handle) {
            const writer = await handle.createWritable();
            await writer.write(result.blob);
            await writer.close();
            setModal("");
            setNotice(`Your collection PDF has been saved: ${result.pages} A4 pages.`);
          } else {
            setDownload({url:URL.createObjectURL(result.blob),name:result.filename});
            setNotice(`Your collection PDF is ready: ${result.pages} A4 pages. Use Save file to keep it.`);
          }
        } finally {pdfAbort.current=null;setPdfProgress(null);}
        return;
      }
      const filename = exportFilename(a.collection.name, format);
      // Open the picker before the network request, preserving browser user activation.
      const picker = (window as SaveWindow).showSaveFilePicker;
      const handle = picker
        ? await picker.call(window, {
            suggestedName: filename,
            types: [
              {
                description:
                  format === "json" ? "JSON archive" : "Markdown document",
                accept: {
                  [format === "json" ? "application/json" : "text/markdown"]: [
                    `.${format}`,
                  ],
                },
              },
            ],
          })
        : null;
      const latest=await api("collection",{collection:a.collection.id});
      const selected=exportEntries(latest.entries,exportIds,exportOrder);
      if(!selected.length)throw new Error("The selected entries are no longer available.");
      const content=format==="json"?JSON.stringify(collectionJson(selected),null,2):collectionMarkdown(latest.collection.name,selected);
      const blob = new Blob([content], {
        type:
          format === "json"
            ? "application/json;charset=utf-8"
            : "text/markdown;charset=utf-8",
      });
      if (handle) {
        const writer = await handle.createWritable();
        await writer.write(blob);
        await writer.close();
        setModal("");
        setNotice("Your collection has been saved.");
      } else setDownload({ url: URL.createObjectURL(blob), name: filename });
    });
  }
  const fans = (v: Archive, eid: string) =>
    v.favorites
      .filter((f) => f.entry_id === eid)
      .map((f) => ({
        id: f.user_id,
        name:
          v.members.find((m) => m.user_id === f.user_id)?.profiles.name ||
          "Chronicler",
      }));
  const fanFaces = (names: { id: string; name: string }[]) => (
    <div className="v-fan-row">
      <div className="v-avatar-stack">
        {names.slice(0, 4).map((n) => (
          <span className="v-avatar" key={n.id} title={n.name}>
            {n.name.slice(0, 1)}
          </span>
        ))}
      </div>
      <span>
        <small>Favorited by</small>
        {names.map((n) => n.name).join(", ")}
      </span>
    </div>
  );
  const storyCards = (
    items: { e: Exhibit; v: Archive }[],
    favorites = false,
  ) => (
    <div className="v-story-grid">
      {items.length ? (
        items.map(({ e, v }) => (
          <article
            className={`v-story-card ${favorites ? "is-treasured" : ""}`}
            key={e.id}
          >
            <Link href={`/stories/${e.id}`} className="v-story-link">
              <div className="v-card-top">
                <span className="eyebrow">
                  {favorites ? "THE HALL’S TREASURES" : e.category}
                </span>
                <Icon name={favorites ? "star" : "scroll"} />
              </div>
              <h3>{e.title}</h3>
              <p>
                {e.preview}
                {e.preview.length === 190 ? "…" : ""}
              </p>
              <div className="v-story-meta">
                <span>{e.authors.join(" & ")}</span>
                <span>{e.minutes} min read</span>
              </div>
            </Link>
            {favorites ? (
              fanFaces(fans(v, e.id))
            ) : (
              <div className="v-card-footer">
                <Link href={`/collections/${v.collection.id}`}>
                  {v.collection.name}
                </Link>
                {v.creators[e.id] === user?.id && (
                  <Link
                    href={`/stories/${e.id}/edit`}
                    className="v-icon"
                    aria-label={`Edit ${e.title}`}
                  >
                    <Icon name="edit" />
                  </Link>
                )}
              </div>
            )}
          </article>
        ))
      ) : (
        <div className="v-empty">
          <Icon name={favorites ? "star" : "scroll"} width="38" height="38" />
          <h3>
            {favorites
              ? "The treasures are yet to be found."
              : "A blank page. An unwritten legend."}
          </h3>
          <p>
            {favorites
              ? "Favorite a story in the reader to keep it here."
              : "Your stories will appear here when you add them."}
          </p>
        </div>
      )}
    </div>
  );
  const dialog = (
    <Modal
      open={!!modal}
      wide={modal==="export"}
      title={
        modal === "create"
          ? "Found a new hall"
          : modal === "rename"
            ? "Rename your collection"
            : modal === "export"
              ? "Take the legends with you"
              : modal === "credentials"
                ? user?.is_anonymous
                  ? "Make this account yours"
                  : "Account credentials"
                : modal === "profileName"
                  ? "Your name in the chronicles"
                  : modal === "invite"
                    ? "A place at your table"
                    : modal === "import"
                      ? "Bring your stories home"
                      : modal === "signout"
                        ? "Leave the archives?"
                        : "A final word"
      }
      onClose={() => {
        if (!busy) setModal("");
      }}
    >
      {feedback}
      {["create", "rename", "profileName"].includes(modal) && (
        <form
          onSubmit={submit(async () => {
            if (modal === "create") {
              const c = await api("createCollection", { name });
              setModal("");
              router.push(`/collections/${c.id}`);
            } else if (modal === "rename") {
              await api("rename", { collection: a?.collection.id, name });
              await load(user!);
              setModal("");
              setNotice("Your collection has a new name.");
            } else {
              await api("profile", { name });
              window.dispatchEvent(new Event("lore-profile-updated"));
              setProfile(name);
              setModal("");
              setNotice("Your name has been updated.");
            }
          })}
        >
          <p className="v-muted">
            {modal === "create"
              ? "A private home for your stories and the people who share them."
              : modal === "rename"
                ? "A new title for the same legends."
                : "How fellow chroniclers will see you."}
          </p>
          {field(
            modal === "profileName" ? "Display name" : "Collection name",
            name,
            setName,
          )}
          <div className="v-form-actions">
            <button
              type="button"
              className="v-button"
              onClick={() => setModal("")}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="v-button v-primary"
              disabled={busy || !name.trim()}
            >
              <Icon name={modal === "create" ? "plus" : "check"} />
              {busy
                ? "Saving…"
                : modal === "create"
                  ? "Create collection"
                  : "Save changes"}
            </button>
          </div>
        </form>
      )}
      {modal === "export" && <><p className="v-muted">Choose the entries and their order, then preview your collection edition.</p><ExportOptions formats={["pdf","json","md"]} format={format} onFormat={f=>{setFormat(f as "json"|"md"|"pdf");setDownload(null);}} busy={busy} exportDisabled={!chosenExports.length} onExport={()=>void exportCollection()} onCancel={()=>setModal("")} download={download}><div className="collection-export-workspace"><CollectionExportEntries entries={a?.entries??[]} selected={exportIds} order={exportOrder} previewId={exportPreview?.id} onSelection={ids=>{setExportIds(ids);setDownload(null);}} onOrder={value=>{setExportOrder(value);setDownload(null);}} onPreview={value=>setExportPreviewId(value.id)} busy={busy}/><div className="collection-export-detail">{format==="pdf"?<><label className="edition-select-label">PDF title<input type="text" value={pdfTitle} maxLength={200} placeholder={a?.collection.name??"Collection"} disabled={busy} onChange={e=>{setPdfTitle(e.target.value);setDownload(null);}}/><small>Used on the cover and end page. Your collection name stays the same.</small></label><CollectionPdfSettings entry={exportPreview} name={pdfTitle.trim()||a?.collection.name||"Collection"} count={chosenExports.length} edition={pdfEdition} design={pdfDesign} onEdition={value=>{setPdfEdition(value);setPdfDesign({...presetDesign(value),pages:true,showCover:false,cover:value,endPage:value});setDownload(null);}} onDesign={value=>{setPdfDesign({...value,pages:true});setDownload(null);}} busy={busy}/></>:<div className="v-panel"><h3>{chosenExports.length} entries in your export</h3><p className="v-muted">The selected entries are exported in the order shown. Entry numbers remain unchanged in your collection.</p><ol>{chosenExports.map(e=><li key={e.id}>No. {String(e.number).padStart(3,"0")} · {e.title}</li>)}</ol></div>}</div></div></ExportOptions>{pdfProgress&&<div className="pdf-export-progress" role="status" aria-live="polite"><progress max={Math.max(1,pdfProgress.total)} value={pdfProgress.story}/><p>{pdfProgress.story} / {pdfProgress.total} stories · {pdfProgress.pages} pages</p><p>{pdfProgress.label}</p><button className="v-button" type="button" onClick={()=>pdfAbort.current?.abort()}>Cancel PDF export</button></div>}</>}
      {modal === "credentials" && (
        <form
          onSubmit={submit(async () => {
            const changedEmail = email !== user?.email;
            const { error } = await supabase().auth.updateUser({
              ...(email && changedEmail ? { email } : {}),
              ...(password ? { password } : {}),
            });
            if (error) throw error;
            const r = await supabase().auth.getUser();
            if (r.data.user) setUser(r.data.user);
            setModal("");
            setNotice(
              !user?.is_anonymous && changedEmail
                ? "Check your inbox to confirm your new email address."
                : "Your account is updated. All your legends stay with you.",
            );
          })}
        >
          <p className="v-muted">
            {user?.is_anonymous
              ? "Keep your collections and favorites across browsers and devices. Your guest account will become an email account."
              : "Update your email or password. Your collections stay with you."}
          </p>
          {field("Email address", email, setEmail, "email")}
          <label className="v-field">
            {user?.is_anonymous
              ? "Choose a password"
              : "New password (optional)"}
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required={user?.is_anonymous}
            />
          </label>
          <div className="v-form-actions">
            <button
              type="button"
              className="v-button"
              onClick={() => setModal("")}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="v-button v-primary"
              disabled={busy || (!password && email === user?.email)}
            >
              <Icon name="shield" />
              {busy
                ? "Saving…"
                : user?.is_anonymous
                  ? "Keep my account"
                  : "Save credentials"}
            </button>
          </div>
        </form>
      )}
      {modal === "invite" && (
        <>
          <p className="v-muted">
            Anyone with this link can join <strong>{a?.collection.name}</strong>
            . It expires in seven days.
          </p>
          {invite ? (
            <>
              <label className="v-field">
                Your invitation link
                <div className="v-copy-field">
                  <input
                    readOnly
                    value={invite}
                    onFocus={(e) => e.target.select()}
                  />
                  {button("Copy", "copy", () =>
                    run(async () => {
                      await navigator.clipboard.writeText(invite);
                      setNotice("Invitation copied.");
                    }),
                  )}
                </div>
              </label>
              <div className="v-form-actions">
                {button("Done", "check", () => setModal(""), true)}
              </div>
            </>
          ) : (
            <div className="v-form-actions">
              {button(
                "Create invite link",
                "plus",
                () =>
                  run(async () => {
                    const r = await api("invite", {
                      collection: a?.collection.id,
                    });
                    setInvite(`${window.location.origin}/invite/${r.token}`);
                    await load(user!);
                  }),
                true,
              )}
            </div>
          )}
        </>
      )}
      {modal === "import" && (
        <>
          <p className="v-muted">
            Import your original JSON archive. Up to 500 entries and 3 MB per
            batch. Existing stories stay untouched.
          </p>
          <label className="v-upload">
            <Icon name="export" width="32" height="32" />
            <strong>
              {importFile ? importFile.name : "Choose a JSON archive"}
            </strong>
            <span>
              {importFile
                ? `${importFile.count} stories ready to import`
                : "Select a file to preview your import"}
            </span>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(async () => {
                    if (file.size > 3_000_000)
                      throw new Error("Choose a JSON file below 3 MB.");
                    const archive = JSON.parse(await file.text());
                    const entries = validateEntries(archive);
                    setImportFile({
                      name: file.name,
                      archive,
                      count: entries.length,
                    });
                  });
              }}
            />
          </label>
          <div className="v-form-actions">
            <button
              className="v-button"
              onClick={() => setModal("")}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="v-button v-primary"
              disabled={!importFile || busy}
              onClick={() =>
                run(async () => {
                  const r = await api("save", {
                    collection: a?.collection.id,
                    archive: importFile?.archive,
                    import: true,
                  });
                  await load(user!);
                  setModal("");
                  setNotice(
                    `${r.count} stories have arrived in your collection.`,
                  );
                })
              }
            >
              <Icon name="plus" />
              {busy
                ? "Importing…"
                : `Import ${importFile?.count || ""} stories`}
            </button>
          </div>
        </>
      )}
      {[
        "deleteEntry",
        "deleteCollection",
        "deleteAccount",
        "signout",
        "revoke",
      ].includes(modal) && (
        <>
          <p className="v-muted">
            {modal === "deleteEntry"
              ? `“${selectedStory?.e.title}” and its favorites will be permanently deleted.`
              : modal === "deleteCollection"
                ? `All stories, memberships, favorites and invitations in “${a?.collection.name}” will be permanently deleted.`
                : modal === "deleteAccount"
                  ? "Your account and every collection you own will be permanently deleted."
                  : modal === "revoke"
                    ? "This invitation will stop admitting new members. Existing members keep their access."
                    : user?.is_anonymous
                      ? "Signing out of a guest account loses access to it. Upgrade your account first to keep your collections."
                      : "You can sign back in whenever the legends call."}
          </p>
          {["deleteEntry", "deleteCollection", "deleteAccount"].includes(
            modal,
          ) && (
            <label className="v-field">
              Type{" "}
              {modal === "deleteCollection" ? a?.collection.name : "DELETE"} to
              confirm
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <div className="v-form-actions">
            <button
              className="v-button"
              onClick={() => setModal("")}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className={`v-button ${modal === "signout" ? "" : "v-destructive"}`}
              disabled={
                busy ||
                (["deleteEntry", "deleteCollection", "deleteAccount"].includes(
                  modal,
                ) &&
                  confirmation !==
                    (modal === "deleteCollection"
                      ? a?.collection.name
                      : "DELETE"))
              }
              onClick={() =>
                run(async () => {
                  if (modal === "deleteEntry") {
                    await api("deleteEntry", {
                      collection: selectedStory?.v.collection.id,
                      entry: selectedStory?.e.id,
                    });
                    setModal("");
                    if(mode==="story" || mode==="edit")router.replace(`/collections/${selectedStory?.v.collection.id}`);
                    else await load(user!);
                    setNotice("Story deleted.");
                  } else if (modal === "deleteCollection") {
                    await api("delete", { collection: a?.collection.id });
                    setModal("");
                    router.replace("/");
                  } else if (modal === "deleteAccount") {
                    await api("deleteAccount");
                    await supabase().auth.signOut();
                    setModal("");
                    router.replace("/login");
                  } else if (modal === "revoke") {
                    await api("revoke", {
                      collection: a?.collection.id,
                      id: confirmation,
                    });
                    await load(user!);
                    setModal("");
                    setNotice("Invitation revoked.");
                  } else {
                    const r = await supabase().auth.signOut();
                    if (r.error) throw r.error;
                    setModal("");
                    router.replace("/login");
                  }
                })
              }
            >
              <Icon name={modal === "signout" ? "logout" : "trash"} />
              {busy
                ? "Working…"
                : modal === "revoke"
                  ? "Revoke invitation"
                  : modal === "signout"
                    ? "Sign out"
                    : "Delete permanently"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
  const frame = (content: React.ReactNode) => (
    <>
      {content}
      {dialog}
    </>
  );
  if (loading) return <ArchiveSkeleton page={mode} story={mode === "story"} />;
  if (mode === "login")
    return frame(
      <main id="main" className="v-auth">
        <section className="v-auth-world">
          <span className="eyebrow">A HOME FOR YOUR LEGENDS</span>
          <h1>
            Some words
            <br />
            deserve to <em>live forever.</em>
          </h1>
          <p>
            Gather your people. Keep the stories.
            <br />
            Give the questionable wisdom its rightful glory.
          </p>
          <VaultMonument />
          <div className="v-auth-footer">
            <Icon name="shield" />
            Private collections. Shared memories.
          </div>
        </section>
        <section className="v-auth-form">
          <div className="v-auth-mark">
            <Icon name="crown" width="30" height="30" />
          </div>
          <span className="eyebrow">WELCOME, CHRONICLER</span>
          <h2>{signup ? "Begin your legend." : "The archives await."}</h2>
          <p>
            {signup
              ? "Your first chapter starts here."
              : "Step back into your world of stories."}
          </p>
          {feedback}
          {user ? (
            <Link className="v-button v-primary" href={nextPath()}>
              Continue to the archives
              <Icon name="arrow" />
            </Link>
          ) : (
            <>
              <div className="v-segmented" aria-label="Account access">
                <button aria-pressed={!signup} onClick={() => setSignup(false)}>
                  Sign in
                </button>
                <button aria-pressed={signup} onClick={() => setSignup(true)}>
                  Create account
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void authenticate();
                }}
              >
                {signup && field("Your name", name, setName)}
                {field("Email address", email, setEmail, "email")}
                {field("Password", password, setPassword, "password")}
                <button className="v-button v-primary v-full" disabled={busy}>
                  {busy
                    ? "Opening the gates…"
                    : signup
                      ? "Create account"
                      : "Enter the archives"}
                  <Icon name="arrow" />
                </button>
              </form>
              <div className="v-or">
                <span />
                or
                <span />
              </div>
              <button
                className="v-button v-full"
                disabled={busy}
                onClick={() => authenticate(true)}
              >
                <Icon name="user" />
                Explore as a guest
              </button>
              <p className="v-auth-note">
                No email needed. You can keep your guest account by upgrading
                later.
              </p>
            </>
          )}
        </section>
      </main>,
    );
  if (!user && mode === "home")
    return frame(
      <main id="main" className="v-lobby">
        <section className="v-lobby-hero">
          <div className="v-lobby-copy">
            <span className="eyebrow">
              <span className="v-gold-dot" /> A HOME FOR YOUR LEGENDS
            </span>
            <h1>
              Every legend<br />needs a <em>home.</em>
            </h1>
            <p>
              A hall for every chapter of your life.<br />
              Built for your people. Filled with your stories.
            </p>
            <Link href="/login" className="v-button v-primary">
              Enter the archives <Icon name="arrow" />
            </Link>
            <div className="v-lobby-footnote">
              <span>EST. IN QUESTIONABLE JUDGEMENT</span><i>❧</i>
            </div>
          </div>
          <VaultMonument />
        </section>
        <section className="v-shelves">
          {feedback}
          <div className="v-empty">
            <Icon name="book" width="40" height="40" />
            <h2>Your stories start here.</h2>
            <p>Sign in or explore as a guest to create your own collections and join your people.</p>
            <Link href="/login" className="v-button">Login <Icon name="arrow" /></Link>
          </div>
        </section>
      </main>,
    );
  if (!user)
    return frame(
      <main id="main" className="v-page">
        {feedback}
        <div className="v-empty">
          <Icon name="shield" width="40" height="40" />
          <h1>The gates are closed.</h1>
          <p>Sign in to enter your private archives.</p>
          <Link href="/login" className="v-button v-primary">
            Enter the archives
            <Icon name="arrow" />
          </Link>
        </div>
      </main>,
    );
  if (mode === "invite")
    return frame(
      <main id="main" className="v-page v-invitation">
        <VaultMonument compact />
        {heading(
          "AN INVITATION TO THE CHRONICLES",
          "A place has been kept for you.",
          "Sign in, step inside, and become part of the story.",
          "link",
        )}
        {feedback}
        {button(
          "Accept invitation",
          "arrow",
          () =>
            run(async () => {
              const c = await api("accept", { token });
              router.replace(`/collections/${c.id}`);
            }),
          true,
        )}
      </main>,
    );
  if (mode === "home")
    return frame(
      <main id="main" className="v-lobby">
        <section className="v-lobby-hero">
          <div className="v-lobby-copy">
            <span className="eyebrow">
              <span className="v-gold-dot" /> YOUR PRIVATE ARCHIVES
            </span>
            <h1>
              Every legend
              <br />
              needs a <em>home.</em>
            </h1>
            <p>
              A hall for every chapter of your life.
              <br />
              Built for your people. Filled with your stories.
            </p>
            {button(
              "Create a collection",
              "plus",
              () => openModal("create"),
              true,
            )}
            <div className="v-lobby-footnote">
              <span>EST. IN QUESTIONABLE JUDGEMENT</span>
              <i>❧</i>
            </div>
          </div>
          <VaultMonument />
        </section>
        <section className="v-shelves">
          <div className="v-section-heading">
            <div>
              <span className="eyebrow">THE STORIES CONTINUE</span>
              <h2>
                Your collections{" "}
                <span>{collections.length.toString().padStart(2, "0")}</span>
              </h2>
            </div>
            <button
              className="v-icon v-plus"
              aria-label="Create a collection"
              onClick={() => openModal("create")}
            >
              <Icon name="plus" />
            </button>
          </div>
          {feedback}
          <div className="v-collection-grid">
            {collections.map((c, i) => (
              <Link
                className={`v-collection-card collection-tone-${i % 3}`}
                href={`/collections/${c.id}`}
                key={c.id}
              >
                <div className="v-collection-cover">
                  <span className="v-volume">
                    VOL. {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="v-role">
                    <Icon name={c.owner_id === user.id ? "crown" : "users"} />
                    {c.owner_id === user.id ? "Keeper" : "Member"}
                  </span>
                  <div className="v-cover-arch">
                    <Icon
                      name={(["crown", "book", "scroll"] as const)[i % 3]}
                      width="46"
                      height="46"
                    />
                    <span>❧</span>
                  </div>
                  <span className="v-cover-line">THE IMMORTAL CHRONICLES</span>
                </div>
                <div className="v-collection-info">
                  <h3>{c.name}</h3>
                  <div>
                    <span>
                      {c.entries?.[0]?.count ?? 0} stories <i>·</i>{" "}
                      {c.members?.[0]?.count ?? 1} members
                    </span>
                    <Icon name="arrow" />
                  </div>
                </div>
              </Link>
            ))}
            <button
              className="v-new-collection"
              onClick={() => openModal("create")}
            >
              <span>
                <Icon name="plus" width="26" height="26" />
              </span>
              <strong>
                {collections.length
                  ? "Another chapter awaits."
                  : "Your first legend starts here."}
              </strong>
              <p>Found a new collection</p>
            </button>
          </div>
        </section>
      </main>,
    );
  if (mode === "profile") {
    const mine = archives.flatMap((v) =>
      v.entries
        .filter(
          (e) =>
            v.creators[e.id] === user.id ||
            e.messages.some(
              (m) =>
                m.userId === user.id,
            ),
        )
        .map((e) => ({ e, v })),
    );
    const favorites = archives.flatMap((v) =>
      v.entries
        .filter((e) =>
          v.favorites.some((f) => f.entry_id === e.id && f.user_id === user.id),
        )
        .map((e) => ({ e, v })),
    );
    const shown = (tab === "favorites" ? favorites : mine).filter(
      ({ e, v }) =>
        (!filter || v.collection.id === filter) &&
        (!query ||
          `${e.title} ${e.preview}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    return frame(
      <main id="main" className="v-page">
        <Link className="v-back" href="/">
          ← Your collections
        </Link>
        <section className="v-profile-banner">
          <div className="v-profile-avatar">
            {profile.slice(0, 1)}
            <span>
              <Icon name="crown" />
            </span>
          </div>
          <div>
            <span className="eyebrow">
              {user.is_anonymous
                ? "WANDERING CHRONICLER"
                : "KEEPER OF CHRONICLES"}
            </span>
            <h1>{profile}</h1>
            <p>
              {user.is_anonymous ? "Your story is just beginning." : user.email}
            </p>
          </div>
          <button
            className="v-icon"
            aria-label="Edit display name"
            onClick={() => openModal("profileName")}
          >
            <Icon name="edit" />
          </button>
          <div className="v-profile-stats">
            <div>
              <strong>{collections.length}</strong>
              <span>Collections</span>
            </div>
            <div>
              <strong>{mine.length}</strong>
              <span>Chronicles</span>
            </div>
            <div>
              <strong>{favorites.length}</strong>
              <span>Favorites</span>
            </div>
          </div>
        </section>
        {feedback}
        {user.is_anonymous && (
          <div className="v-upgrade-banner">
            <Icon name="shield" width="28" height="28" />
            <div>
              <strong>Give your legends a permanent home.</strong>
              <p>
                Keep this account across devices. Every story and favorite stays
                yours.
              </p>
            </div>
            {button(
              "Keep my account",
              "arrow",
              () => openModal("credentials"),
              true,
            )}
          </div>
        )}
        <div className="v-tabs" aria-label="Profile sections">
          {(
            [
              ["entries", "Your chronicles", "scroll"],
              ["favorites", "Your favorites", "star"],
              ["settings", "Account settings", "settings"],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              aria-pressed={tab === key}
              key={key}
              onClick={() => setTab(key)}
            >
              <Icon name={icon} />
              {label}
              <span>
                {key === "entries"
                  ? mine.length
                  : key === "favorites"
                    ? favorites.length
                    : ""}
              </span>
            </button>
          ))}
        </div>
        {tab === "settings" ? (
          <div className="v-settings-grid">
            <section className="v-panel">
              <div className="v-panel-head">
                <Icon name="user" />
                <h2>Personal details</h2>
              </div>
              <div className="v-setting-row">
                <div>
                  <span>Display name</span>
                  <strong>{profile}</strong>
                </div>
                {button("Edit", "edit", () => openModal("profileName"))}
              </div>
              <div className="v-setting-row">
                <div>
                  <span>Email address</span>
                  <strong>{user.email || "Guest account"}</strong>
                </div>
                {button(
                  user.is_anonymous ? "Upgrade" : "Update",
                  "shield",
                  () => openModal("credentials"),
                )}
              </div>
              <div className="v-setting-row">
                <div>
                  <span>Password</span>
                  <strong>
                    {user.is_anonymous ? "No password yet" : "••••••••••••"}
                  </strong>
                </div>
                {button(user.is_anonymous ? "Set up" : "Change", "edit", () =>
                  openModal("credentials"),
                )}
              </div>
            </section>
            <section className="v-panel">
              <div className="v-panel-head">
                <Icon name="shield" />
                <h2>Your account</h2>
              </div>
              <p>Your chapters are waiting whenever you return.</p>
              {button("Sign out", "logout", () => openModal("signout"))}
              <div className="v-danger-block">
                <h3>Delete account</h3>
                <p>
                  Permanently delete your account and all collections you own.
                </p>
                <button
                  className="v-danger-link"
                  onClick={() => openModal("deleteAccount")}
                >
                  Delete my account
                  <Icon name="trash" />
                </button>
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className="v-feed-controls">
              <label className="v-search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "favorites"
                      ? "Find a favorite…"
                      : "Find your chronicle…"
                  }
                  aria-label="Search your entries"
                />
              </label>
              <select
                className="v-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter by collection"
              >
                <option value="">All collections</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {storyCards(shown, tab === "favorites")}
          </>
        )}
      </main>,
    );
  }
  if (!a)
    return frame(
      <main id="main" className="v-page">
        {back}
        {feedback}
        <div className="v-empty">
          <Icon name="book" />
          <h1>This archive could not be opened.</h1>
          <p>It may have been deleted, or you may need an invitation.</p>
        </div>
      </main>,
    );
  if (mode === "story") {
    if (!entry)
      return frame(
        <main id="main" className="v-page">
          {back}
          <h1>Chronicle not found.</h1>
        </main>,
      );
    const index = a.entries.findIndex((e) => e.id === id),
      ownFavorite = a.favorites.some(
        (f) => f.entry_id === id && f.user_id === user.id,
      ),
      names = fans(a, entry.id);
    const adjacent = (n: number) => {
      const e = a.entries[index + n];
      return e ? { id: e.id, title: e.title } : null;
    };
    const favoriteControl = (
      <div className="v-reader-social">
        <button
          className={`v-favorite ${ownFavorite ? "is-favorite" : ""}`}
          title={ownFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-label={ownFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={ownFavorite}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("favorite", {
                collection: a.collection.id,
                entry: id,
                remove: ownFavorite,
              });
              setArchives((old) =>
                old.map((v) => ({
                  ...v,
                  favorites: ownFavorite
                    ? v.favorites.filter(
                        (f) => !(f.entry_id === id && f.user_id === user.id),
                      )
                    : [
                        ...v.favorites,
                        { entry_id: entry.id, user_id: user.id },
                      ],
                })),
              );
            })
          }
        >
          <Icon name="star" />
        </button>
        {names.length > 0 && fanFaces(names)}
      </div>
    );
    return frame(
      <>
        {(error || notice) && (
          <div className="v-reader-feedback">{feedback}</div>
        )}
        <Reader
          key={entry.id}
          entry={entry}
          previous={adjacent(-1)}
          next={adjacent(1)}
          collectionId={a.collection.id}
          collectionName={a.collection.name}
          favoriteControl={favoriteControl}
          titleActions={entryActions(entry,a)}
        />
      </>,
    );
  }
  if (["new", "edit"].includes(mode)) {
    if (mode === "edit" && !ownEntry)
      return frame(
        <main id="main" className="v-page">
          {back}
          {heading(
            "THE CHRONICLES",
            "This is another keeper’s story.",
            "You can edit only entries you created.",
            "shield",
          )}
        </main>,
      );
    function changeMessage(index: number, change: Partial<DraftMessage>) {
      setMessages((old) =>
        old.map((m, i) =>
          i === index
            ? {
                ...m,
                ...change,
                ...("content" in change
                  ? {
                      original: undefined,
                      presentation: undefined,
                      sourceFormat: "markdown",
                    }
                  : {}),
              }
            : m,
        ),
      );
    }
    return frame(
      <main id="main" className="v-page v-editor">
        {back}
        {heading(
          mode === "edit" ? "REVISE THE CHRONICLE" : "A NEW CHAPTER",
          mode === "edit" ? "Every legend can evolve." : "Words worth keeping.",
          mode === "edit"
            ? "Refine your story. Its place in the collection stays the same."
            : "Write something extraordinary. Or extraordinarily questionable.",
          "scroll",
        )}
        {feedback}
        <form
          onSubmit={submit(async () => {
            const base =
              mode === "edit"
                ? entry!
                : {
                    type: messages.length > 1 ? "discussion" : "single",
                    score: 0,
                    reason: "",
                    source: "LoreKeeper",
                  };
            const r = await api(mode === "edit" ? "updateEntry" : "save", {
              collection: a.collection.id,
              ...(mode === "edit" ? { entry: id } : {}),
              archive: { entries: [{ ...base, title, messages }] },
            });
            router.push(`/stories/${r.id}`);
          })}
        >
          <div className="v-editor-grid">
            <section className="v-panel v-writing-panel">
              <label className="v-field">
                The title
                <input
                  placeholder="Give your legend a name…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={500}
                  required
                />
              </label>
              {messages.map((m, i) => (
                <section className="v-message-editor" key={m.id}>
                  <div className="v-message-heading">
                    <span className="eyebrow">
                      {messages.length > 1
                        ? `PASSAGE ${String(i + 1).padStart(2, "0")}`
                        : "THE CHRONICLE"}
                    </span>
                    {messages.length > 1 && (
                      <button
                        type="button"
                        className="v-icon"
                        aria-label={`Remove passage ${i + 1}`}
                        onClick={() =>
                          setMessages(messages.filter((_, n) => n !== i))
                        }
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  <div className="v-author-fields">
                    <label className="v-field">
                      Attributed to
                      <select
                        value={m.userId || ""}
                        onChange={(e) => {
                          const selected = a.members.find(
                            (x) => x.user_id === e.target.value,
                          );
                          changeMessage(i, {
                            userId: selected?.user_id,
                            author: selected?.profiles.name || m.author,
                          });
                        }}
                      >
                        <option value="">An author name</option>
                        {a.members.map((member) => (
                          <option value={member.user_id} key={member.user_id}>
                            {member.profiles.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!m.userId && (
                      <label className="v-field">
                        Author name
                        <input
                          value={m.author}
                          onChange={(e) =>
                            changeMessage(i, { author: e.target.value })
                          }
                          required
                          maxLength={120}
                        />
                      </label>
                    )}
                  </div>
                  <label className="v-field">
                    Message date and time
                    <input type="datetime-local" aria-label={`Passage ${i+1} date and time`} value={messageDateTimeValue(m.timestamp)} onChange={e=>changeMessage(i,{timestamp:messageDateTimeTimestamp(e.target.value)})} required/>
                    <small className="v-muted">Europe/Zurich time</small>
                  </label>
                  <MarkdownEditor label={`Passage ${i + 1} content`} value={m.content} onChange={content=>changeMessage(i,{content})}/>
                  <div className="v-editor-caption">
                    <span>Markdown welcome. Words preserved.</span>
                    <span>
                      {m.content.trim().split(/\s+/).filter(Boolean).length}{" "}
                      words
                    </span>
                  </div>
                </section>
              ))}
              <button
                type="button"
                className="v-button v-text-button"
                onClick={() =>
                  setMessages([
                    ...messages,
                    {
                      id: crypto.randomUUID(),
                      author: profile,
                      userId: user.id,
                      content: "",
                      timestamp: new Date().toISOString(),
                      source: "LoreKeeper",
                      sourceFormat: "markdown",
                    },
                  ])
                }
              >
                <Icon name="plus" />
                Add another passage
              </button>
            </section>
            <aside className="v-editor-aside">
              <div className="v-panel">
                <Icon name="crown" width="30" height="30" />
                <span className="eyebrow">PRESERVED IN</span>
                <h2>{a.collection.name}</h2>
                <p>
                  {mode === "edit"
                    ? "Your revisions update the existing story and keep its favorites."
                    : "Every member of this collection will be able to read your story."}
                </p>
                <div className="v-divider" />
                <p>
                  Choose a member for attribution, or give an author’s name. You
                  remain the keeper who can edit this entry.
                </p>
              </div>
            </aside>
          </div>
          <div className="v-editor-bottom">
            <Link
              href={
                mode === "edit"
                  ? `/stories/${id}`
                  : `/collections/${a.collection.id}`
              }
              className="v-button"
            >
              Cancel
            </Link>
            <button className="v-button v-primary" disabled={busy}>
              <Icon name="check" />
              {busy
                ? "Sealing the chronicle…"
                : mode === "edit"
                  ? "Save changes"
                  : "Publish to collection"}
            </button>
          </div>
        </form>
      </main>,
    );
  }
  if (mode === "settings") {
    const authors = [
      ...new Set(a.entries.flatMap((e) => e.messages.filter(m=>!m.userId).map((m) => m.fallbackAuthor || m.author))),
    ].sort();
    const sections = [
      ["general", "Collection", "settings"],
      ["members", admin ? "People & authors" : "People", "users"],
      ["invitations", "Invitations", "link"],
      ["records", admin ? "Import & export" : "Export", "scroll"],
    ] as const;
    const visibleSections = sections.filter(([key]) => admin || key !== "invitations");
    const settingsTab = visibleSections.some(([key])=>key===adminTab) ? adminTab : "general";
    return frame(
      <main id="main" className="v-page">
        {back}
        {heading(
          "COLLECTION SETTINGS",
          a.collection.name,
          "A little order behind the extraordinary.",
          "settings",
        )}
        {feedback}
        <div className="v-council-layout">
          <aside className="v-council-nav">
            <span className="eyebrow">{admin ? "MANAGE YOUR HALL" : "EXPLORE YOUR HALL"}</span>
            {visibleSections.map(([key, label, icon]) => (
              <button
                key={key}
                aria-pressed={settingsTab === key}
                onClick={() => setAdminTab(key)}
              >
                <Icon name={icon} />
                {label}
                <Icon name="chevron" />
              </button>
            ))}
            <div className="v-council-note">
              <Icon name={admin ? "crown" : "users"} />
              <p>{admin ? "You are the keeper of this collection." : "You are a member of this collection."}</p>
            </div>
          </aside>
          <section className="v-council-content">
            {settingsTab === "general" && (
              <>
                <section className="v-panel">
                  <div className="v-panel-head">
                    <Icon name="book" />
                    <h2>Collection charter</h2>
                  </div>
                  <div className="v-setting-row">
                    <div>
                      <span>Collection name</span>
                      <strong>{a.collection.name}</strong>
                    </div>
                    {admin && button("Rename", "edit", () => openModal("rename"))}
                  </div>
                  <div className="v-mini-stats">
                    <div>
                      <strong>{a.entries.length}</strong>
                      <span>Stories preserved</span>
                    </div>
                    <div>
                      <strong>{a.members.length}</strong>
                      <span>Fellow chroniclers</span>
                    </div>
                    <div>
                      <strong>
                        {new Set(a.favorites.map((f) => f.entry_id)).size}
                      </strong>
                      <span>Treasured stories</span>
                    </div>
                  </div>
                </section>
                {admin && <section className="v-panel v-danger-panel">
                  <div>
                    <h3>Close this hall</h3>
                    <p>
                      Delete the collection and everything within it. This
                      cannot be undone.
                    </p>
                  </div>
                  <button
                    className="v-button v-destructive"
                    onClick={() => openModal("deleteCollection")}
                  >
                    <Icon name="trash" />
                    Delete collection
                  </button>
                </section>}
              </>
            )}
            {settingsTab === "members" && (
              <>
                <section className="v-panel">
                  <div className="v-panel-head">
                    <Icon name="users" />
                    <h2>The people of this hall</h2>
                    {admin && <button
                      className="v-icon v-plus"
                      aria-label="Invite a member"
                      onClick={() => {
                        setInvite("");
                        openModal("invite");
                      }}
                    >
                      <Icon name="plus" />
                    </button>}
                  </div>
                  {a.members.map((m) => (
                    <div className="v-member-row" key={m.user_id}>
                      <span className="v-avatar">{m.profiles.name[0]}</span>
                      <strong>{m.profiles.name}</strong>
                      <span className="v-role-chip">
                        {m.user_id === a.collection.owner_id
                          ? "Keeper"
                          : "Member"}
                      </span>
                    </div>
                  ))}
                </section>
                {admin && <section className="v-panel">
                  <div className="v-panel-head">
                    <Icon name="edit" />
                    <h2>Names behind the legends</h2>
                  </div>
                  <p>
                    Connect original author names to collection members. Their
                    stories will appear on their profile.
                  </p>
                  {authors.length ? (
                    authors.map((author) => (
                      <div className="v-assignment-row" key={author}>
                        <span>{author}</span>
                        <Icon name="arrow" />
                        <select
                          className="v-select"
                          disabled={busy}
                          aria-label={`Assign ${author} to a member`}
                          value=""
                          onChange={(e) => {
                            const userId = e.target.value;
                            void run(async () => {
                              const linked=await api("assign", {
                                collection: a.collection.id,
                                author,
                                userId,
                              });
                              await load(user);
                              setNotice(`${linked.count} stories now belong to their author.`);
                            });
                          }}
                        >
                          <option value="">Unassigned</option>
                          {a.members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.profiles.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  ) : (
                    <div className="v-empty is-small">
                      <p>
                        Every name is linked. Unassigned author names will appear here.
                      </p>
                    </div>
                  )}
                </section>}
              </>
            )}
            {admin && settingsTab === "invitations" && (
              <section className="v-panel">
                <div className="v-panel-head">
                  <Icon name="link" />
                  <h2>An open invitation</h2>
                  {button(
                    "New invitation",
                    "plus",
                    () => {
                      setInvite("");
                      openModal("invite");
                    },
                    true,
                  )}
                </div>
                <p>
                  Bring someone into the story. Share a link, and they’ll arrive
                  in this collection after signing in.
                </p>
                {a.invites.length ? (
                  a.invites.map((i, index) => {
                    const expired = new Date(i.expires_at) < new Date();
                    return (
                      <div className="v-invite-row" key={i.id}>
                        <span className="v-invite-icon">
                          <Icon name="link" />
                        </span>
                        <div>
                          <strong>
                            Invitation {String(index + 1).padStart(2, "0")}
                          </strong>
                          <span>
                            {expired ? "Expired" : "Valid until"}{" "}
                            {new Date(i.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={`v-status-chip ${expired ? "is-expired" : ""}`}
                        >
                          {expired ? "Expired" : "Active"}
                        </span>
                        <button
                          className="v-icon"
                          aria-label={`Revoke invitation ${index + 1}`}
                          onClick={() => {
                            openModal("revoke");
                            setConfirmation(i.id);
                          }}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="v-empty">
                    <Icon name="link" width="36" height="36" />
                    <h3>A place for your people.</h3>
                    <p>
                      Create your first invitation to welcome a fellow
                      chronicler.
                    </p>
                  </div>
                )}
              </section>
            )}
            {settingsTab === "records" && (
              <div className={`v-record-grid ${admin ? "" : "is-readonly"}`}>
                {admin && <section className="v-panel v-record-card">
                  <Icon name="plus" width="36" height="36" />
                  <span className="eyebrow">BRING THE PAST WITH YOU</span>
                  <h2>Import your stories.</h2>
                  <p>
                    Give your old JSON archive a new home. Preview the file
                    before adding it to your collection.
                  </p>
                  {button(
                    "Import JSON",
                    "plus",
                    () => openModal("import"),
                    true,
                  )}
                </section>}
                <section className="v-panel v-record-card">
                  <Icon name="export" width="36" height="36" />
                  <span className="eyebrow">TAKE THE LEGENDS WITH YOU</span>
                  <h2>A copy for posterity.</h2>
                  <p>
                    Choose entries and their order, then save a PDF edition, JSON archive or Markdown chronicle.
                  </p>
                  {button("Export collection", "export", () =>
                    openModal("export"),
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </main>,
    );
  }
  if (mode === "favorites") {
    const items = a.entries
      .filter((e) => a.favorites.some((f) => f.entry_id === e.id))
      .filter(
        (e) =>
          !query ||
          `${e.title} ${e.preview}`.toLowerCase().includes(query.toLowerCase()),
      )
      .map((e) => ({ e, v: a }));
    return frame(
      <main id="main" className="v-page">
        {back}
        <section className="v-treasure-hero">
          <div className="v-treasure-seal">
            <Icon name="star" width="45" height="45" />
          </div>
          <span className="eyebrow">THE COLLECTIVE’S CROWN JEWELS</span>
          <h1>
            Some legends
            <br />
            shine <em>brighter.</em>
          </h1>
          <p>
            The stories your people keep coming back to.
            <br />
            Treasured together in {a.collection.name}.
          </p>
          <div className="v-treasure-count">
            <span>
              {new Set(a.favorites.map((f) => f.entry_id)).size} treasured
              stories
            </span>
            <i>✦</i>
            <span>
              {new Set(a.favorites.map((f) => f.user_id)).size} admirers
            </span>
          </div>
        </section>
        {feedback}
        <div className="v-section-heading">
          <h2>The hall’s favorites</h2>
          <label className="v-search">
            <Icon name="search" />
            <input
              aria-label="Search shared favorites"
              placeholder="Find a treasured story…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {storyCards(items, true)}
      </main>,
    );
  }
  return frame(
    <>
      {(error || notice) && <div className="v-reader-feedback">{feedback}</div>}
      <Hall
        exhibits={a.entries}
        stats={statsFor(a.entries)}
        collectionName={a.collection.name}
        collectionActions={
          <div className="v-hall-actions">
            <Link
              href={`/collections/${a.collection.id}/new`}
              className="v-button v-primary"
            >
              <Icon name="plus" />
              New entry
            </Link>
            <Link
              href={`/collections/${a.collection.id}/favorites`}
              className="v-button"
            >
              <Icon name="star" />
              Favorites
              <span className="v-button-count">
                {new Set(a.favorites.map((f) => f.entry_id)).size}
              </span>
            </Link>
            <div className="v-hall-secondary">
              <button
                className="v-icon"
                aria-label="Export collection"
                title="Export collection"
                onClick={() => openModal("export")}
              >
                <Icon name="export" />
              </button>
              <Link
                  className="v-icon"
                  aria-label="Collection settings"
                  title="Settings"
                  href={`/collections/${a.collection.id}/settings`}
                >
                  <Icon name="settings" />
                </Link>
            </div>
          </div>
        }
      />
    </>,
  );
}

