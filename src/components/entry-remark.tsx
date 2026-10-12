import type {Exhibit} from '../lib/archive';
import {authorName,dateLabel,displayTime} from '../lib/format';
import {withoutEmojis} from '../lib/emojis';
export function EntryRemark({entry,showEmojis=true}:{entry:Exhibit;showEmojis?:boolean}){
 if(entry.messages.length!==1)return null;
 const message=entry.messages[0],author=message.userId?message.author:authorName(message.author);
 return <div className="entry-title-remark"><span>{showEmojis?author:withoutEmojis(author)}</span>{message.timestamp&&<><span aria-hidden="true"> · </span><time dateTime={message.timestamp}>{dateLabel(message.timestamp)} · {displayTime(message.timestamp)}</time></>}</div>;
}
