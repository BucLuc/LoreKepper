import type {Exhibit} from './archive';
export const collectionOrders=[{id:'number',name:'Entry number · lowest first'},{id:'number-desc',name:'Entry number · highest first'},{id:'newest',name:'Date · newest first'},{id:'oldest',name:'Date · oldest first'},{id:'title',name:'Title · A–Z'},{id:'title-desc',name:'Title · Z–A'},{id:'longest',name:'Reading time · longest first'}] as const;
export type CollectionOrder=typeof collectionOrders[number]['id'];
export function orderEntries(entries:readonly Exhibit[],order:CollectionOrder='number'){
 return [...entries].sort((a,b)=>{const difference=order==='number-desc'?b.number-a.number:order==='newest'?b.time-a.time:order==='oldest'?a.time-b.time:order==='title'?a.title.localeCompare(b.title,undefined,{numeric:true,sensitivity:'base'}):order==='title-desc'?b.title.localeCompare(a.title,undefined,{numeric:true,sensitivity:'base'}):order==='longest'?b.minutes-a.minutes:a.number-b.number;return difference||a.number-b.number||a.id.localeCompare(b.id);});
}
export function exportEntries(entries:readonly Exhibit[],selected:ReadonlySet<string>,order:CollectionOrder){return orderEntries(entries.filter(entry=>selected.has(entry.id)),order);}
