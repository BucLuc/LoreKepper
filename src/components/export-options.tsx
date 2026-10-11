"use client";
import { Icon } from "./icon";
export function ExportOptions({formats=["json","md"],format,onFormat,busy,onExport,onCancel,download}:{formats?:string[];format:string;onFormat:(format:string)=>void;busy:boolean;onExport:()=>void;onCancel:()=>void;download?:{url:string;name:string}|null}) {
  return <>
    <div className="v-format-options">{formats.map(f=><button type="button" key={f} className={`v-format-option ${format===f?"selected":""}`} onClick={()=>onFormat(f)} aria-pressed={format===f} disabled={busy}>
      <Icon name={f==="json"?"format":"scroll"}/><strong>{f==="json"?"JSON archive":f==="md"?"Markdown":"PDF edition"}</strong>
      <span>{f==="json"?"Original structure, no IDs. Ready to reimport.":f==="md"?"A readable chronicle, ready to share.":"An illustrated edition, ready to save."}</span><i>.{f}</i>
    </button>)}</div>
    {download ? <div className="v-download-ready"><Icon name="check"/><div><strong>Your export is ready.</strong><p>Your browser controls the save location.</p></div><a className="v-button v-primary" href={download.url} download={download.name}><Icon name="export"/>Save file</a></div>
    : <div className="v-form-actions"><button type="button" className="v-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="v-button v-primary" onClick={onExport} disabled={busy}><Icon name="export"/>{busy?"Preparing export…":"Export"}</button></div>}
  </>;
}
