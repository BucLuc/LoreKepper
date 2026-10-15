"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {pdfPaperColors} from '../lib/pdf-editions';

/** `layoutKey` must change exactly when the rendered document changes; `children` is a new element on every parent render. */
export function PagedDocument({children,layoutKey}:{children:ReactNode;layoutKey:string}) {
 const source=useRef<HTMLDivElement>(null),output=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(1),[error,setError]=useState('');
 useEffect(()=>{const observer=new ResizeObserver(()=>setScale(Math.min(1,(host.current?.clientWidth??794)/794)));observer.observe(host.current!);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const controller=new AbortController();
  async function render(){
   let slot:HTMLDivElement|undefined;
   try{
    // Previous pages stay visible until the new layout is complete.
    const target=output.current!;target.dataset.ready='false';
    await document.fonts.ready;
    const article=source.current!.querySelector<HTMLElement>('article')!;
    await Promise.all(Array.from(article.querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));
    if(controller.signal.aborted)return;
    // The live reader must initialize the same opaque paper material as the PDF exporter.
    article.style.setProperty('--pdf-page-bg',pdfPaperColors[article.dataset.background??'']??getComputedStyle(article).backgroundColor);
    article.dataset.readingPages='true';
    article.classList.add('pdf-print-document','pdf-source');
    const {paginateStory}=await import('../lib/export-collection-pdf');
    slot=document.createElement('div');source.current!.append(slot);
    const pages:HTMLElement[]=[];
    await paginateStory(article,slot,1,async page=>{if(!controller.signal.aborted)pages.push(page.cloneNode(true) as HTMLElement);},controller.signal);
    if(!controller.signal.aborted){target.replaceChildren(...pages);target.dataset.ready='true';setError('');}
   }catch(e){if(!controller.signal.aborted){output.current?.replaceChildren();setError((e as Error).message);}}
   finally{slot?.remove();}
  }
  void render();return()=>controller.abort();
 },[layoutKey]);
 return <div className="reader-paged collection-pdf-host" ref={host}>{error?<><p role="status">Page layout unavailable: {error}</p>{children}</>:null}<div className="reader-page-source" ref={source} aria-hidden="true">{children}</div><div className="reader-page-output" ref={output} style={{zoom:scale}}/></div>;
}
