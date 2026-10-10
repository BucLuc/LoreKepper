"use client";
import { Icon } from "./icon";
export function Feedback({children,onDismiss,error=false}:{children:React.ReactNode;onDismiss:()=>void;error?:boolean}) {
  return <div className={`v-feedback ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>
    <Icon name={error ? "shield" : "check"}/><span>{children}</span>
    <button type="button" className="v-icon" aria-label={error ? "Dismiss error" : "Dismiss message"} onClick={onDismiss}><Icon name="close"/></button>
  </div>;
}
