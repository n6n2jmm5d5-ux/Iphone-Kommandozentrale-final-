#!/usr/bin/env node
/**
 * Automated footage sourcing from Wikimedia Commons (MediaWiki API).
 * Free, no API key. Licenses checked per file, source and attribution saved.
 * Does not scrape Pexels/Mixkit or bypass download restrictions.
 * Usage: node auto-footage.mjs "fresh cooking chef" [--out ./film-assets] [--count 5]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createWriteStream} from 'node:fs';
const endpoint='https://commons.wikimedia.org/w/api.php';
const topic=process.argv[2]||'professional cooking kitchen';
const arg=k=>{const i=process.argv.indexOf(k);return i<0?null:process.argv[i+1]};
const out=path.resolve(arg('--out')||'./rml-footage');
const count=Math.max(1,Math.min(8,Number(arg('--count')||5)));
const topicTerms=topic.toLowerCase().normalize('NFKD').replace(/[^a-z0-9äöüß ]/g,' ').split(/\\s+/).filter(x=>x.length>4).slice(0,6);
const queries=[...new Set([...topicTerms.map(t=>t+' cooking chef'), 'professional chef cooking kitchen','cooking in pan','chopping vegetables cooking','food plating chef','restaurant kitchen cooking'])];
const headers={'User-Agent':'RML-EditorialVideo/0.1 (independent editorial research; Wikimedia Commons API)','Accept':'application/json'};
const get=async params=>{const u=new URL(endpoint);for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));const r=await fetch(u,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Commons API '+r.status);return r.json()};
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const licenseOk=(name,url)=>/^(CC BY(?:-SA)?(?: [234]\.0)?|CC0|Public domain|PD)/i.test(name)||/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/|publicdomain\/)/i.test(url);
const used=new Set(),selected=[],errors=[];
await fs.mkdir(out,{recursive:true});
for(let i=0;i<queries.length&&selected.length<count;i++){
 const q=queries[i];
 try{
  const data=await get({action:'query',generator:'search',gsrsearch:q+' filetype:video',gsrnamespace:6,gsrlimit:40,prop:'imageinfo',iiprop:'url|extmetadata|size|mime',format:'json',formatversion:2});
  const pages=(data.query?.pages||[]).filter(p=>p.imageinfo?.[0]);
  for(const page of pages){
   if(selected.length>=count)break;
   const info=page.imageinfo[0],meta=info.extmetadata||{};
   const name=strip(meta.LicenseShortName?.value),licenseUrl=strip(meta.LicenseUrl?.value);
   const url=info.url;
   if(!url||used.has(url)||!licenseOk(name,licenseUrl))continue;
   if(!/video\/(webm|ogg|mp4)|application\/ogg/i.test(info.mime||''))continue;
   if(info.size>150*1024*1024||info.size<1000000)continue;
   if(!/\\.(webm|ogv|ogg|mp4)$/i.test(page.title))continue;
   const extension=info.mime==='video/mp4'?'mp4':info.mime==='video/webm'?'webm':'ogv';
   const target=path.join(out,'scene-'+(selected.length+1)+'.'+extension);
   try{
    const r=await fetch(url,{headers,signal:AbortSignal.timeout(120000)});
    if(!r.ok||!r.body)throw Error('download HTTP '+r.status);
    await pipeline(Readable.fromWeb(r.body),createWriteStream(target));
    const stat=await fs.stat(target);if(stat.size<100000)throw Error('too small');
    selected.push({file:path.basename(target),title:page.title,source:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_')),license:name,licenseUrl,author:strip(meta.Artist?.value),credit:strip(meta.Attribution?.value),size:stat.size,downloadUrl:url});
    used.add(url);
   }catch(e){await fs.rm(target,{force:true});errors.push(page.title+': '+e.message)}
  }
 }catch(e){errors.push(q+': '+e.message)}
}
const manifest={topic,status:selected.length===count?'footage acquired; review required':'incomplete',licensePolicy:'Only Commons files with compatible open licenses; attribution and any share-alike conditions must be honored; human review required before publishing',selected,errors};
await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({out,found:selected.length,requested:count,status:manifest.status,errors:errors.slice(0,5)},null,2));
if(selected.length<count)process.exitCode=2;
