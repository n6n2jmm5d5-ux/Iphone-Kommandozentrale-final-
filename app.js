const sections=[
['buero','Büro','Startseite: deine Agenten, Aufgaben und Zahlen auf einen Blick'],
['auftrag','Auftrag','Aufgabe reinschreiben, der passende Agent übernimmt'],
['werkbank','Werkbank','Mehrere Chats nebeneinander (Claude und Codex)'],
['vorschau','Vorschau','Seiten, Bilder, Videos und Texte ansehen, die gerade entstehen'],
['werkstatt','Werkstatt','Carousels prüfen und Videos schneiden'],
['ablage','Ablage','Alles, was heute entstanden ist, plus Tagesverlauf'],
['kanaele','Kanäle','Instagram, TikTok und YouTube: Zahlen und Reels'],
['leads','Leads','Firmen finden, prüfen und nachfassen: dein Mini-CRM'],
['mails','Mails','Mitglieder-Mails prüfen und freigeben'],
['funde','Fundstücke','Neue Tools und Ideen von GitHub'],
['skills','Skills','Alle Fähigkeiten von Claude, per Klick starten']
];
let active='buero';
const nav=document.querySelector('#nav'),main=document.querySelector('#main');
function renderNav(){nav.innerHTML='';sections.forEach(([id,name,desc])=>{const b=document.createElement('button');b.textContent=name;b.title=desc;b.className=id===active?'on':'';b.onclick=()=>{active=id;render()};nav.appendChild(b)})}
function render(){renderNav();const s=sections.find(x=>x[0]===active);main.innerHTML=`<section class="page"><span class="eyebrow">Kommandozentrale</span><h1>${s[1]}</h1><p>${s[2]}</p><div class="panel"><b>${s[1]}</b><p>Dieser Bereich wird aus der vorhandenen Desktop-Kommandozentrale auf die iPhone-Oberfläche übertragen.</p></div></section>`}
document.querySelector('#briefing').onclick=()=>{main.innerHTML='<section class="page"><span class="eyebrow">Briefing</span><h1>Dein Tagesplan von heute früh</h1></section>'};
document.querySelector('#chat').onsubmit=e=>{e.preventDefault();const p=document.querySelector('#prompt');if(!p.value.trim())return;alert('Auftrag vorgemerkt: '+p.value.trim());p.value=''};
document.querySelector('#plus').onclick=()=>alert('Neue Sitzung: Claude, Codex oder Agent – Anbindung folgt aus dem Original-Workflow.');
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');