"use client";
import { useEffect,useRef,useState } from "react";
import { Icon } from "./icon";
export function EntryMenu({title,onEdit,onDelete}:{title:string;onEdit:()=>void;onDelete:()=>void}) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);trigger.current?.focus();}};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};
  },[open]);
  return <div className={`v-entry-menu ${open ? "is-open" : ""}`} ref={ref}>
    <button type="button" ref={trigger} className="v-icon" aria-label={`Options for ${title}`} aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="more"/></button>
    {open && <div className="v-entry-popover" aria-label="Entry options">
      <button type="button" onClick={()=>{setOpen(false);onEdit();}}><Icon name="edit"/>Edit</button>
      <button type="button" className="v-danger-link" onClick={()=>{setOpen(false);onDelete();}}><Icon name="trash"/>Delete</button>
    </div>}
  </div>;
}
