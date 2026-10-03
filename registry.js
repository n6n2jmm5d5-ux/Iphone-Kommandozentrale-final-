// Shared inventory; the matching rule is the existing app.js rule.
globalThis.KZRegistry=Object.freeze({
  agents:Object.freeze([
    Object.freeze({id:'chatgpt',name:'ChatGPT',client:'codex',executable:true}),
    Object.freeze({id:'claude',name:'Claude',client:'claude',executable:false})
  ]),
  skills:Object.freeze([
    Object.freeze({id:'codex-read',agent:'chatgpt',name:'Codex: Lesen und Antworten',mode:'read-only',executable:true}),
    Object.freeze({id:'codex-write',agent:'chatgpt',name:'Codex: Projektdateien bearbeiten',mode:'workspace-write',executable:true,requiresApproval:true})
  ]),
  tools:Object.freeze(['node','python','git','ffmpeg']),
  route(text,chosen='auto',connected=()=>false){
    if(chosen!=='auto')return chosen;
    const preferred=/recherch|analys|programm|code|github|datei|pdf|video|strategie|plan|vergleich|mehrstufig|website|automatis|fehler|debug/i.test(text)?'chatgpt':'claude';
    if(connected(preferred))return preferred;
    const other=preferred==='claude'?'chatgpt':'claude';
    return connected(other)?other:preferred;
  }
});
