"use client";
import {EntryRemark} from "./entry-remark";
import {authorName,dateLabel,displayTime} from "../lib/format";
import {prepareGalleryMarkdown} from "../lib/gallery-markdown";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Exhibit } from "../lib/archive";
import { normalizeDesign, editionPalettes, type EditionDesign } from "../lib/edition-design";
import { resolveReaderFont } from "../lib/reader-fonts";
import { galleryFrames, galleryCovers, galleryEditions } from "../lib/gallery-editions";
import { EditionMarkdown } from "./edition-markdown";
import { withoutEmojis } from "../lib/emojis";
import { contentUnits, appendUnit, fitsPage, splitToFit, normalizePdfArtwork, type LaidOutPage } from "../lib/pdf-pagination";
let borderInstance=0;
export function GalleryDocument({ entry, style, size = 18, design, font, plain = false, showEmojis = true }: {
    entry: Exhibit;
    style: string;
    size?: number;
    design?: EditionDesign;
    font?: string;
    plain?: boolean;
    showEmojis?: boolean;
}) {
    const conversation=entry.messages.length>1;
    const speakers=[...new Set(entry.messages.map(message=>message.userId?message.author:authorName(message.author)))];
    const chosen = normalizeDesign(design, style), id = style.replace("gallery-", "");
    const source = useRef<HTMLDivElement>(null), output = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1), [error, setError] = useState("");
    const selectedFont=font??chosen.font;
    const face = resolveReaderFont(style, selectedFont), palette = editionPalettes[chosen.background];
    const frame = chosen.background === style ? galleryFrames[id] : galleryFrames[id].replace(/fill="#(?:f1e6c9|f2e2bf|f0e7cd|f5e9cf|eee0bd)"/g, `fill="${palette.surface}"`);
    const prepared=entry.messages.map((message,index)=>prepareGalleryMarkdown(message.presentation??message.content,index===0?entry.title:"",index===0&&chosen.showCover!==false));
    const coverSubtitle=showEmojis?prepared[0]?.subtitle:withoutEmojis(prepared[0]?.subtitle??"");
    const title = showEmojis ? entry.title : withoutEmojis(entry.title);
    useEffect(() => { const observer = new ResizeObserver(() => setScale(Math.min(1, (host.current?.clientWidth ?? 794) / 794))); observer.observe(host.current!); return () => observer.disconnect(); }, []);
    useEffect(() => {
        let cancelled = false;
        async function layout() {
            await document.fonts.ready;
            const images = Array.from(source.current!.querySelectorAll('img'));
            await Promise.all(images.map(img => img.decode().catch(() => { })));
            if (cancelled)
                return;
            const target = output.current!;
            target.dataset.ready = 'false';
            const template = source.current!.querySelector<HTMLElement>('article')!;
            target.replaceChildren();
            setError("");
            const firstProse=template.querySelector<HTMLElement>('.gallery-content .gallery-prose p:not(.setting-note):not(.manuscript-field)');
            template.classList.remove('pdf-initials-ready');
            template.querySelectorAll('.pdf-initial').forEach(node=>node.replaceWith(document.createTextNode(node.textContent??'')));
            template.querySelectorAll('.opening').forEach(node=>node.classList.remove('opening'));
            if(firstProse && chosen.initial!=='off' && (!conversation || chosen.initial!=='preset') && (firstProse.textContent?.length??0)>80) firstProse.classList.add('opening');
            normalizePdfArtwork(template);
            if (!chosen.pages) {
                const block = template.cloneNode(true) as HTMLElement;
                block.classList.add('gallery-block');
                const originalFrame=block.querySelector<SVGSVGElement>('.frame-art')!;
                if(chosen.border){
                    const border=document.createElement('div');border.className='gallery-block-frame';
                    for(const [part,viewBox] of [['top','0 0 794 561.5'],['middle','0 200 794 723'],['bottom','0 561.5 794 561.5']]){
                        const art=originalFrame.cloneNode(true) as SVGSVGElement;art.classList.remove('frame-art');art.classList.add('block-frame-'+part);art.setAttribute('viewBox',viewBox);art.setAttribute('preserveAspectRatio','none');
                        if(part==='middle'){
                            // Repeat a real-length section of the original border instead of elongating a one-pixel slice.
                            const patternId='manuscript-border-'+(++borderInstance);
                            art.removeAttribute('viewBox');art.replaceChildren();
                            const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
                            const pattern=document.createElementNS('http://www.w3.org/2000/svg','pattern');
                            pattern.id=patternId;pattern.setAttribute('patternUnits','userSpaceOnUse');pattern.setAttribute('width','794');pattern.setAttribute('height','723');pattern.setAttribute('viewBox',viewBox);
                            pattern.append(...Array.from(originalFrame.childNodes).map(node=>node.cloneNode(true)));defs.append(pattern);art.append(defs);
                            const fill=document.createElementNS('http://www.w3.org/2000/svg','rect');fill.setAttribute('width','100%');fill.setAttribute('height','100%');fill.setAttribute('fill',`url(#${patternId})`);art.append(fill);
                        }
                        border.append(art);
                    }
                    originalFrame.replaceWith(border);
                }else originalFrame.remove();
                const flow=block.querySelector<HTMLElement>('.paper-body')!;
                const metrics=getComputedStyle(template.querySelector('.paper-body')!);
                const cover=block.querySelector<HTMLElement>('.gallery-cover');if(cover)flow.prepend(cover);
                flow.style.margin=`${metrics.top} ${metrics.right} ${metrics.bottom} ${metrics.left}`;
                target.append(block);
                target.dataset.ready = 'true';
                return;
            }
            let number = 0;
            const create = () => { const element = template.cloneNode(true) as HTMLElement; element.classList.remove('gallery-block'); element.classList.add('gallery-page'); const body = element.querySelector<HTMLElement>('.column')!; body.replaceChildren(); const flow = body; element.querySelector('.folio-number')!.textContent = String(++number); target.append(element); return { element, body, flow, wrappers: new Map(), units: 0 } as LaidOutPage; };
            if (chosen.showCover) {
                const cover = create();
                cover.element.classList.add('title-page');
                const coverFlow=cover.element.querySelector<HTMLElement>('.paper-body')!;
                coverFlow.replaceChildren(template.querySelector('.gallery-cover')!.cloneNode(true));
                cover.body=coverFlow;cover.flow=coverFlow;
                const heading=cover.body.querySelector<HTMLElement>('.cover-title')!;
                let titleSize=parseFloat(getComputedStyle(heading).fontSize);
                while(cover.body.scrollHeight>cover.body.clientHeight+1 && titleSize>18){titleSize-=2;heading.style.fontSize=`${titleSize}px`;}
                if(cover.body.scrollHeight>cover.body.clientHeight+1){const art=cover.body.querySelector<HTMLElement>('.cover-illustration');if(art)art.style.height='180px';}
            }
            const units = contentUnits(template.querySelector<HTMLElement>('.gallery-content')!);
            let page = create();
            if (!chosen.showCover)
                page.body.append(template.querySelector('.gallery-title-opening')!.cloneNode(true));
            for (let i = 0; i < units.length; i++) {
                const unit = units[i];
                if (!conversation && /^H[12]$/.test(unit.node.tagName) && page.units && !(page.units === 1 && units[i - 1]?.keepNext))
                    page = create();
                if (unit.node.matches(".message-attribution") && /^H[12]$/.test(units[i + 1]?.node.tagName ?? "") && page.units)
                    page = create();
                let added = appendUnit(page, unit);
                if (fitsPage(page)) {
                    if(unit.keepNext && units[i+1] && page.units){
                        const following=units[i+1];const preview=following.node.cloneNode(true) as HTMLElement;
                        if(preview.matches('p,li,pre')){preview.style.maxHeight='3.3em';preview.style.overflow='hidden';}
                        const next=appendUnit(page,following,preview);const together=fitsPage(page);next.undo();
                        if(!together){added.undo();page=create();added=appendUnit(page,unit);}
                    }
                    page.units++;
                    continue;
                }
                added.undo();
                let split = splitToFit(page, unit);
                if (!split && page.units) {
                    page = create();
                    added = appendUnit(page, unit);
                    if (fitsPage(page)) {
                        page.units++;
                        continue;
                    }
                    added.undo();
                    split = splitToFit(page, unit);
                }
                if (split) {
                    split[1].classList.remove("opening");split[1].classList.add("continuation");
                    appendUnit(page, unit, split[0]);
                    page.units++;
                    page = create();
                    units.splice(i + 1, 0, { ...unit, node: split[1], keepNext: false });
                }
                else {
                    added = appendUnit(page, unit);
                    added.copy.querySelectorAll<HTMLElement>('img').forEach(img => img.style.maxHeight = '700px');
                    if (!fitsPage(page)) {
                        const width=added.copy.getBoundingClientRect().width;
                        const height=Math.max(added.copy.scrollHeight,added.copy.offsetHeight);
                        const ratio=Math.min(1,(page.body.clientHeight-30)/height);
                        const holder=document.createElement('div');
                        holder.style.cssText=`position:relative;height:${height*ratio}px;width:100%;`;
                        added.copy.replaceWith(holder);holder.append(added.copy);
                        added.copy.style.cssText+=`;position:absolute;top:0;left:0;width:${width}px;transform:scale(${ratio});transform-origin:top left;`;
                        setError('An oversized block has been scaled to fit A4.');
                    }
                    page.units++;
                }
            }
            let running='';
            for(const leaf of Array.from(target.children)){
                const headings=Array.from(leaf.querySelectorAll('.column h1,.column h2,.column h3,.column h4,.column h5,.column h6'));
                if(headings.length)running=headings[headings.length-1].textContent??'';
                const footer=leaf.querySelector('.running-section');if(footer)footer.textContent=running.slice(0,70);
                const note=leaf.querySelector('.margin-note');if(note)note.textContent=(headings[0]?.textContent??running).slice(0,180);
            }
            target.dataset.ready = 'true';
        }
        void layout();
        return () => { cancelled = true; };
    }, [entry, style, size, chosen.pages, chosen.showCover, chosen.background, chosen.border, chosen.artwork, chosen.initial, frame, conversation, selectedFont, plain, showEmojis]);
    const fontClass=selectedFont==="galleryblackletter"?"blackletter":selectedFont==="galleryuncial"?"illuminated":selectedFont==="galleryfell"?"letterpress":"classic";
    const fontScale=fontClass==="blackletter"?1.15:["illuminated","letterpress"].includes(fontClass)?1.05:1;
    const vars = { "--line": fontClass==="blackletter"?"1.75":"1.63", "--font": `${size*19/18*fontScale}px`, "--body-font": fontClass==="illuminated"?'"Scriptorium Fell", Georgia, serif':face.family, "--heading-font": face.family, "--paper-surface": palette.surface } as CSSProperties;
    return <div className="gallery-reader" ref={host} style={vars}>{error && <p role="status">{error}</p>}<div className="gallery-measure" ref={source} aria-hidden="true"><article className={`sheet t-${id} font-${fontClass} ${chosen.background.startsWith("gallery-paper-") ? "paper-" + chosen.background.replace("gallery-paper-", "") : ""}`} data-initial={chosen.initial} data-conversation={conversation?"on":"off"} data-border={chosen.border ? 'on' : 'off'} style={{ ...vars, ...(chosen.background !== style ? { backgroundColor: palette.surface, backgroundImage: chosen.background === "ancientcodex" ? "url(/textures/library-vellum.svg)" : undefined } : {}) }}>
 <svg className="frame-art" style={{color:"#a77e3d"}} viewBox="0 0 794 1123" preserveAspectRatio="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: frame }}/><div className="paper-grain"/><div className="page-head">{title}<span className="head-ornament" aria-hidden="true">· ◆ ·</span></div><div className="page-emblem" aria-hidden="true">✣</div><div className="margin-note"/><div className="paper-body"><div className="column">
 {chosen.showCover ? <div className="gallery-cover cover-content"><div className="cover-kicker">{galleryEditions.find(edition=>edition.id===style)?.name}</div><h1 className="cover-title">{title}</h1><EntryRemark entry={entry} showEmojis={showEmojis}/><div className="cover-rule" aria-hidden="true"/>{chosen.artwork && <svg className="cover-illustration" viewBox="0 0 400 380" aria-hidden="true" dangerouslySetInnerHTML={{ __html: galleryCovers[id] }}/>}{coverSubtitle&&<p className="cover-subtitle">{coverSubtitle}</p>}<div className="cover-ribbon">AN ILLUMINATED MANUSCRIPT</div></div> : <div className="gallery-title-opening"><h1 className="gallery-title-only">{title}</h1><EntryRemark entry={entry} showEmojis={showEmojis}/></div>}
 <div className="gallery-content">{entry.messages.map((message, index) => { let text=prepared[index].body; if (!showEmojis)
        text = withoutEmojis(text); const speaker=message.userId?message.author:authorName(message.author);return <section key={message.id} className={conversation?"manuscript-message":undefined} data-speaker={speakers.indexOf(speaker)%2}>{conversation&&<header className="manuscript-message-head"><span className="manuscript-speaker">{showEmojis?speaker:withoutEmojis(speaker)}</span>{message.timestamp&&<time dateTime={message.timestamp}>{dateLabel(message.timestamp)} · {displayTime(message.timestamp)}</time>}</header>}{plain ? <pre>{text}</pre> : <EditionMarkdown text={text} style={style}/>}</section>; })}</div></div></div><div className="page-footer"><span className="running-section"></span><span className="folio-number">1</span></div></article></div>
 <div className="gallery-output" style={{ zoom: scale }} ref={output}/></div>;
}



