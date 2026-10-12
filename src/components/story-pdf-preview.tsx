"use client";
import {useEffect,useRef,useState} from "react";
import type {Exhibit} from "../lib/archive";
import type {EditionDesign} from "../lib/edition-design";
import {readerEditions} from "../lib/reader-editions";
import {pdfPaperColors} from "../lib/pdf-editions";
import {StoryDocument} from "./story-document";

/** Preview the first measured A4 page, using the exporter’s real paginator. */
export function StoryPdfPreview({entry,preset,design}: {entry:Exhibit;preset:string;design:EditionDesign}) {
  const frame=useRef<HTMLDivElement>(null),source=useRef<HTMLDivElement>(null),paper=useRef<HTMLDivElement>(null);
  const [error,setError]=useState("");
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    if(preset.startsWith("gallery-"))return;
    const controller=new AbortController();
    const node=frame.current!,target=paper.current!;
    const resize=()=>node.style.setProperty("--preview-scale",String(node.clientWidth/(210*96/25.4)));
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    const slot=document.createElement("div");source.current!.append(slot);
    async function render() {
      try {
        const [{paginateStory},{normalizePdfArtwork}]=await Promise.all([import("../lib/export-collection-pdf"),import("../lib/pdf-pagination")]);
        await document.fonts.ready;
        if(controller.signal.aborted) return;
        const article=source.current!.querySelector<HTMLElement>("article")!;
        if(design.columns==="preset") article.dataset.columns=design.body==="newspaper"?"two":"one";
        article.classList.add("pdf-print-document","pdf-source");
        article.style.setProperty("--pdf-page-bg",pdfPaperColors[design.background]);
        article.style.backgroundColor=pdfPaperColors[design.background];
        normalizePdfArtwork(article);
        await paginateStory(article,slot,1,async page=>{
          if(controller.signal.aborted) return;
          target.replaceChildren(page.cloneNode(true));
          resize();setError("");
          throw new DOMException("Preview complete","AbortError");
        },controller.signal);
      } catch(e) {
        if(!controller.signal.aborted && (e as Error).name!=="AbortError") setError((e as Error).message);
      }
    }
    void render();
    return ()=>{controller.abort();observer.disconnect();slot.remove();};
  },[entry,preset,design]);
  if(preset.startsWith("gallery-"))return <StoryDocument entry={entry} style={preset} theme={readerEditions.find(e=>e.id===preset)!} design={{...design,pages:true}} font={design.font} size={16}/>;
  return <section className={`pdf-story-preview ${expanded?"is-expanded":""}`} aria-label="Story page preview">
    <div className="pdf-preview-heading"><span>Story page · A4 layout</span><button type="button" className="v-button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?"Smaller preview":"Enlarge preview"}</button></div>
    {error?<p className="v-muted">{error}</p>:null}
    <div className="pdf-preview-frame collection-pdf-host" ref={frame} aria-hidden="true">
      <div className="pdf-preview-source" ref={source}><StoryDocument key={JSON.stringify({preset,design,entry})} entry={entry} style={preset} theme={readerEditions.find(e=>e.id===preset)!} design={{...design,pages:false}} font={design.font} size={16}/></div>
      <div className="pdf-preview-paper" ref={paper}/>
    </div>
  </section>;
}

