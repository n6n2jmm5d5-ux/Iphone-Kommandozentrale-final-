// Free, on-demand topic research. No AI API, subscriptions or automated publishing.
// Run: node research.mjs  > topic-suggestions.json
const queries=['Küchenhandwerk Gastronomie','Restaurant Preis Leistung Deutschland','Gastronomie Service Qualität','Convenience Food Restaurant'];
const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const field=(xml,tag)=>decode(xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'').trim();
const result=[];const errors=[];
for(const q of queries){
 try{
  const url='https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=de&gl=DE&ceid=DE:de';
  const res=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'user-agent':'RML-Research/1.0'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  const xml=await res.text();
  const items=xml.match(/<item>[\s\S]*?<\/item>/g)||[];
  for(const item of items.slice(0,5)){
   const title=field(item,'title'),link=field(item,'link'),published=field(item,'pubDate');
   if(title&&link.startsWith('https://'))result.push({topic:q,headline:title,sourceUrl:link,publishedAt:published,reviewRequired:true});
  }
 }catch(e){errors.push({query:q,error:e.message})}
}
console.log(JSON.stringify({generatedAt:new Date().toISOString(),suggestions:result,errors,notice:'Ungeprüfte Quellenhinweise, keine fertigen Faktenbehauptungen. Redaktionelle Prüfung erforderlich.'},null,2));
