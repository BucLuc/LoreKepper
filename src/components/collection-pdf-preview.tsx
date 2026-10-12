"use client";
import { useEffect, useRef, useState } from "react";
import { CollectionBookend } from "./collection-bookend";

export function CollectionPdfPreview({name,count,edition,font,cover=edition,endPage=edition,background}: {name:string;count:number;edition:string;font:string;cover?:string|null;endPage?:string|null;background?:string}) {
  const [expanded,setExpanded] = useState(false);
  return <section className={`pdf-bookend-previews ${expanded ? "is-expanded" : ""}`} aria-label="PDF cover and end page preview">
    <div className="pdf-preview-heading"><span>Bookend preview · A4</span><button type="button" className="v-button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Smaller preview" : "Enlarge preview"}</button></div>
    {[false,true].map(end=>{const selected=end?endPage:cover;return selected?<BookendPreview key={String(end)} name={name} count={count} edition={selected} font={font} end={end} background={background} fontPreset={edition}/>:<div className="pdf-disabled-bookend" key={String(end)}><span>{end?"End page":"Cover page"}</span><p>Not included</p><small>Choose artwork above</small></div>;})}
  </section>;
}
export function BookendPreview({name,count,edition,font,end,background,fontPreset}: {name:string;count:number;edition:string;font:string;end:boolean;background?:string;fontPreset?:string}) {
  const frame=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=frame.current!;
    let active=true;
    function resize() {
      if (!active) return;
      const article=node.querySelector<HTMLElement>("article")!;
      node.style.setProperty("--preview-scale",String(node.clientWidth/article.offsetWidth));
      const title=article.querySelector<HTMLElement>(".document-header h2")!;
      title.style.removeProperty("font-size");
      let size=parseFloat(getComputedStyle(title).fontSize);
      while(article.scrollHeight>article.clientHeight+1 && size>18) {
        size-=2;title.style.setProperty("font-size",`${size}px`,"important");
      }
    }
    const observer=new ResizeObserver(resize);
    observer.observe(node);resize();
    void document.fonts.ready.then(resize);
    return ()=>{active=false;observer.disconnect();};
  },[name,count,edition,font,background,fontPreset]);
  return <figure className="pdf-preview-figure">
    <figcaption>{end ? "End page" : "Cover page"}</figcaption>
    <div className="pdf-preview-frame" ref={frame}><div className="collection-pdf-host pdf-preview-paper" aria-hidden="true"><CollectionBookend name={name} count={count} style={edition} font={font} end={end} background={background} fontPreset={fontPreset}/></div></div>
  </figure>;
}
