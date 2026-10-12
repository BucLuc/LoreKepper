/** Only the document's opening title/subtitle are cover material; later Markdown stays intact. */
export function prepareGalleryMarkdown(text:string,title:string,cover:boolean){
 const body=text.replace(/^\s*#\s+(.+)(?:\r?\n|$)/,(match,heading:string)=>heading.trim().toLocaleLowerCase()===title.trim().toLocaleLowerCase()?'':match);
 const subtitle=cover?body.match(/^\s*(?:\*([^*\r\n]+)\*|_([^_\r\n]+)_)\s*(?:\r?\n\s*\r?\n|$)/):null;
 return {body:subtitle?body.slice(subtitle[0].length):body,subtitle:subtitle?(subtitle[1]??subtitle[2]):''};
}
