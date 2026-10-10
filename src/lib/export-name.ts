export function exportFilename(title:string,extension:string,edition?:string,date=new Date()) {
  const name=title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,"-").trim().slice(0,100) || "LoreKeeper";
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
  return `${name}${edition ? ` — ${edition}` : ""} — ${day}.${extension}`;
}
