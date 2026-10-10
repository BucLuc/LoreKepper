"use client";
import { useEffect, useId, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { clipboardMarkdown } from "@/lib/markdown-editor";

const controls = [
  {name:"bold",label:"Bold (Ctrl+B)",mark:"B",run:(e:Editor)=>e.chain().focus().toggleBold().run()},
  {name:"italic",label:"Italic (Ctrl+I)",mark:"I",run:(e:Editor)=>e.chain().focus().toggleItalic().run()},
  {name:"strike",label:"Strikethrough",mark:"S",run:(e:Editor)=>e.chain().focus().toggleStrike().run()},
  {name:"heading",label:"Heading",mark:"H₂",run:(e:Editor)=>e.chain().focus().toggleHeading({level:2}).run()},
  {name:"bulletList",label:"Bullet list",mark:"• ≡",run:(e:Editor)=>e.chain().focus().toggleBulletList().run()},
  {name:"orderedList",label:"Numbered list",mark:"1. ≡",run:(e:Editor)=>e.chain().focus().toggleOrderedList().run()},
  {name:"taskList",label:"Checklist",mark:"☑",run:(e:Editor)=>e.chain().focus().toggleTaskList().run()},
  {name:"blockquote",label:"Quote",mark:"❞",run:(e:Editor)=>e.chain().focus().toggleBlockquote().run()},
  {name:"code",label:"Inline code (Ctrl+E)",mark:"`x`",run:(e:Editor)=>e.chain().focus().toggleCode().run()},
  {name:"codeBlock",label:"Code block",mark:"</>",run:(e:Editor)=>e.chain().focus().toggleCodeBlock().run()},
];
export function MarkdownEditor({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}) {
  const id = useId();
  const [linkOpen,setLinkOpen] = useState(false);
  const [url,setUrl] = useState("");
  const editor = useEditor({
    immediatelyRender:false,
    extensions:[StarterKit.configure({underline:false,link:{openOnClick:false}}),Markdown,TaskList,TaskItem.configure({nested:true}),TableKit,Placeholder.configure({placeholder:"Once upon a questionable decision…"})],
    content:value,contentType:"markdown",
    onUpdate:({editor})=>onChange(editor.getMarkdown()),
    editorProps:{
      attributes:{class:"v-md-preview v-md-visual",role:"textbox","aria-label":label,"aria-multiline":"true"},
      handlePaste:(view,event)=>{
        const html=event.clipboardData?.getData("text/html");
        if(!html)return false;
        try {
          const markdown=clipboardMarkdown(html);
          if(!markdown)return false;
          const instance=editor;
          if(!instance)return false;
          event.preventDefault();instance.commands.insertContent(markdown,{contentType:"markdown"});return true;
        }catch {return false;}
      },
    },
  });
  const state = useEditorState({editor,selector:({editor:e})=>({
    active:controls.map(c=>e?.isActive(c.name) ?? false),link:e?.isActive("link") ?? false,
    table:e?.isActive("table") ?? false,undo:e?.can().undo() ?? false,redo:e?.can().redo() ?? false,
  })});
  useEffect(()=>{
    if(editor && value!==editor.getMarkdown()) editor.commands.setContent(value,{contentType:"markdown",emitUpdate:false});
  },[editor,value]);
  function openLink() {if(!editor)return;setUrl(editor.getAttributes("link").href || "");setLinkOpen(true);}
  function saveLink() {
    if(!editor)return;
    const href=url.trim();
    if(!href)editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if(/^(https?:\/\/|mailto:|\/|#)/i.test(href))editor.chain().focus().extendMarkRange("link").setLink({href}).run();
    else return;
    setLinkOpen(false);
  }
  return <div className="v-md-editor" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openLink();}}}>
    <div className="v-md-top"><div className="v-md-tools" role="group" aria-label={`${label} formatting`}>
      {controls.map((c,i)=><button key={c.name} type="button" title={c.label} aria-label={c.label} aria-pressed={state?.active[i] ?? false} disabled={!editor} onMouseDown={e=>e.preventDefault()} onClick={()=>editor && c.run(editor)}><span className={`md-${c.name}`}>{c.mark}</span></button>)}
      <button type="button" title="Link (Ctrl+K)" aria-label="Link (Ctrl+K)" aria-pressed={state?.link ?? false} disabled={!editor} onMouseDown={e=>e.preventDefault()} onClick={openLink}>↗</button>
      <button type="button" title="Insert table" aria-label="Insert table" disabled={!editor || state?.table} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}>▦</button>
      <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!state?.undo} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().undo().run()}>↶</button>
      <button type="button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!state?.redo} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().redo().run()}>↷</button>
    </div></div>
    {linkOpen && <div className="v-md-link"><label htmlFor={id}>Link address</label><input id={id} type="url" placeholder="https://…" value={url} autoFocus onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();saveLink();}if(e.key==="Escape"){e.preventDefault();setLinkOpen(false);editor?.commands.focus();}}}/><button type="button" className="v-btn" onClick={saveLink}>Apply</button>{state?.link && <button type="button" className="v-btn" onClick={()=>{editor?.chain().focus().extendMarkRange("link").unsetLink().run();setLinkOpen(false);}}>Remove link</button>}<button type="button" className="v-btn" onClick={()=>{setLinkOpen(false);editor?.commands.focus();}}>Cancel</button></div>}
    <EditorContent editor={editor}/>
    {!editor && <div className="v-md-preview v-skeleton" aria-label="Loading editor"/>}
    <textarea className="v-md-validation" aria-hidden="true" tabIndex={-1} value={editor?.isEmpty ? "" : value} readOnly required onInvalid={e=>{e.preventDefault();editor?.commands.focus();}}/>
    <div className="v-md-hint">Select text to format · Markdown shortcuts supported · Paste formatted text from Teams or Word</div>
  </div>;
}
