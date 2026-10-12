/** Preview zoom always respects the space left beside the customization panel. */
export function previewZoom(requested:number,available:number,width:number){
 const maximum=Math.max(1,Math.floor(Math.min(2,Math.max(1,available-32)/width)*100));
 const minimum=Math.min(25,maximum);
 return {minimum,maximum,percent:Math.max(minimum,Math.min(requested,maximum))};
}
