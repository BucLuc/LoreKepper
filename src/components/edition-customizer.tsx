"use client";
import { useId, useState } from "react";
import { designFonts, resolveReaderFont } from "../lib/reader-fonts";
import { editionPalettes, backgroundChoices, formatOptions, switchEditionDesign, isCustomDesign, type EditionDesign } from "../lib/edition-design";
const tabs = ["Layout", "Background", "Font", "Options"] as const;
export function EditionCustomizer({ preset, value, onChange, disabled = false, pdf = false }: {
    preset: string;
    value: EditionDesign;
    onChange: (value: EditionDesign) => void;
    disabled?: boolean;
    pdf?: boolean;
}) {
    const [active, setActive] = useState<(typeof tabs)[number]>("Layout"), id = useId();
    const update = (patch: Partial<EditionDesign>) => onChange({ ...value, ...patch });
    const fonts = designFonts(preset), options = formatOptions(preset);
    const choices = active === "Background" ? backgroundChoices(preset) : fonts;
    const current = active === "Background" ? value.background : value.font;
    const index = Math.max(0, choices.findIndex(o => o.id === current));
    const choose = (choice: string) => update(active === "Background" ? { background: choice } : { font: choice });
    const flag = (key: "border" | "artwork", label: string) => <label className="edition-option"><input type="checkbox" checked={value[key]} disabled={disabled} onChange={e => update({ [key]: e.target.checked })}/><span>{label}</span></label>;
    const treatment = (key: "initial" | "columns" | "numbering", label: string) => <div className="edition-treatment"><span>{label}</span><div role="group" aria-label={label}>{[{ id: "preset", name: "Original" }, { id: key === "columns" ? "one" : "off", name: key === "columns" ? "One column" : "Off" }, { id: key === "columns" ? "two" : "on", name: key === "columns" ? "Two columns" : "On" }].map(o => <button type="button" key={o.id} aria-pressed={value[key] === o.id} disabled={disabled} onClick={() => update({ [key]: o.id })}>{o.name}</button>)}</div></div>;
    return <section className="edition-studio edition-controls" aria-label="Display customization"><div className="edition-control-bar"><div className="studio-tabs" role="tablist" aria-label="Display settings">{tabs.map(tab => <button key={tab} type="button" role="tab" id={`${id}-${tab}`} aria-selected={active === tab} aria-controls={`${id}-options`} onClick={() => setActive(tab)}>{tab}</button>)}</div><button type="button" className="studio-reset" onClick={() => onChange(switchEditionDesign(value, preset))} disabled={disabled || !isCustomDesign(value, preset)}>Reset</button></div><div id={`${id}-options`} role="tabpanel" aria-labelledby={`${id}-${active}`} className="edition-control-content">
 {active === "Layout" && <div className="edition-local-options">{!pdf&&<label className="edition-option"><input type="checkbox" checked={value.pages === true} onChange={e => update({ pages: e.target.checked })} disabled={disabled}/><span>Show A4 pages<small>Separate sheets with measured text flow. Turn off for continuous reading.</small></span></label>}<label className="edition-option"><input type="checkbox" checked={value.showCover !== false} onChange={e => update({ showCover: e.target.checked })} disabled={disabled}/><span>{pdf?"Illustrated story openings":"Show cover page"}<small>{pdf?"Include frontispieces for individual entries. Choose the collection cover above.":"Include the illustrated opening. Turn off to keep the title only."}</small></span></label></div>}
 {active !== "Options" && active !== "Layout" && <><label className="edition-select-label">{active}<select disabled={disabled} value={current} onChange={e => choose(e.target.value)}>{choices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>{active === "Background" ? <div className="edition-swatches" role="group" aria-label="Page background">{backgroundChoices(preset).map(o => <button type="button" key={o.id} className="edition-paper-choice" style={{ background: editionPalettes[o.id]?.surface, color: editionPalettes[o.id]?.ink }} title={o.name} aria-label={o.name} aria-pressed={value.background === o.id} onClick={() => update({ background: o.id })} disabled={disabled}>{o.name}</button>)}</div> : <div className="edition-font-sample" style={{ fontFamily: resolveReaderFont(preset, value.font).family }}>The keeper of forgotten stories<br /><small>{index + 1} / {fonts.length} typefaces</small></div>}</>}
 {active === "Options" && <div className="edition-local-options">{options.border && flag("border", preset === "manuscript" ? "Colorful illuminated border" : "Ornate manuscript border")}{options.artwork && flag("artwork", preset === "space" ? "Relay instruments" : "Decorative artwork")}{options.initial && <label className="edition-select-label">First letter style<select value={value.initial} disabled={disabled} onChange={e=>update({initial:e.target.value as EditionDesign["initial"]})}><option value="preset">Format default</option><option value="off">None</option><option value="on">Basic drop cap</option><option value="gilded">Flourished blackletter</option><option value="illuminated">Uncial initial</option><option value="penwork">Flourished calligraphy</option></select></label>}{options.columns && treatment("columns", "Page columns")}{options.numbering && treatment("numbering", "Paragraph numbers")}{!Object.values(options).some(Boolean) && <p>This format keeps its original layout. Customize its background and font.</p>}</div>}
 </div></section>;
}

