// Import individually downloaded, licensed stock footage into the existing film pipeline.
// No scraping, no paid APIs. Source URLs are stored for editorial verification.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.dirname(new URL(import.meta.url).pathname);
const manifestPath=path.join(root,'manifest-film.json');
const sources=[
 {file:'clips/messerarbeit.mp4',source:'https://www.pexels.com/video/chef-with-vegetables-in-kitchen-11025688/',seconds:4.8,overlay:'FRISCH ALLEIN REICHT NICHT.'},
 {file:'clips/pfanne.mp4',source:'https://www.pexels.com/video/a-man-in-an-apron-cooking-in-a-kitchen-4252286/',seconds:6.5,overlay:'ENTSCHEIDEND IST DAS KÖNNEN.'},
 {file:'clips/anrichten.mp4',source:'https://www.pexels.com/video/a-chef-cooking-food-in-the-kitchen-8626269/',seconds:6.5,overlay:'HITZE. TIMING. HANDWERK.'},
 {file:'clips/service.mp4',source:'https://www.pexels.com/video/a-man-in-an-apron-cooking-in-a-kitchen-4252286/',seconds:6.5,overlay:'GUTES ESSEN IST KEIN ZUFALL.'},
 {file:'clips/gericht.mp4',source:'https://www.pexels.com/video/a-chef-cooking-food-in-the-kitchen-8626269/',seconds:7.5,overlay:'WORAN ERKENNST DU EINEN GUTEN KOCH?'}
];
const missing=sources.filter(s=>!fs.existsSync(path.join(root,s.file)));
const probe=file=>{const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file],{encoding:'utf8'});return p.status===0?Number(p.stdout.trim()):0};
const invalid=sources.filter(s=>!missing.includes(s)&&probe(path.join(root,s.file))<s.seconds);
const manifest={status:'Entwurf',title:'Wer im Restaurant frisch kocht, ist noch lange kein guter Koch.',clips:sources.map(({file,seconds,overlay})=>({file,seconds,overlay})),sources:sources.map(({file,source})=>({file,source,license:'Pexels License; verify the individual clip and rights before publication'}))};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({manifestPath,missing,invalid,ready:missing.length===0&&invalid.length===0,next:'Download each selected clip legally from its source page, save under the indicated file path, then verify and approve the manifest before rendering.'},null,2));
if(missing.length||invalid.length)process.exitCode=2;
