import {parseTimestamp} from './format';
const zone='Europe/Zurich';
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function messageDateTimeValue(timestamp:string){
 if(!timestamp)return '';
 const date=new Date(parseTimestamp(timestamp));
 const parts=formatter.formatToParts(date),get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
/** Convert the editor's Zurich wall time into the UTC timestamp used by entries. */
export function messageDateTimeTimestamp(value:string){
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
 if(!match)return '';
 const [,year,month,day,hour,minute]=match;
 const local=Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute));
 let candidate=local;
 for(let i=0;i<3;i++){
  const parts=formatter.formatToParts(candidate),get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const represented=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'));
  candidate=local-(represented-candidate);
 }
 const timestamp=new Date(candidate).toISOString();
 return messageDateTimeValue(timestamp)===value?timestamp:'';
}
