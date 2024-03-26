const{ipcRenderer:ipcRenderer}=require("electron"),{constants:constants,readFileSync:readFileSync,readdirSync:readdirSync,ensureDirSync:ensureDirSync,copyFileSync:copyFileSync,accessSync:accessSync,writeFileSync:writeFileSync,pathExistsSync:pathExistsSync}=require("fs-extra"),{fork:fork}=require("child_process"),{join:join}=require("path"),PRODUCTION=!0;function render(){const e=join(__dirname,"../../../../copies"),t=join(__dirname,"../../../../backups"),n=join(__dirname,"../../../../translation");!function(){try{return void accessSync(n,constants.F_OK)}catch(e){alert("Не удалось найти файлы перевода. Убедитесь, что вы включили папку translation в корневую директорию программы."),ipcRenderer.send("quit")}try{return accessSync(join(n,"maps"),constants.F_OK),void accessSync(join(n,"other"),constants.F_OK)}catch(e){alert("Программа не может обнаружить папки с файлами перевода внутри папки translation. Убедитесь, что в папке translation присутствуют подпапки maps и other."),ipcRenderer.send("quit")}}(),function(){if(function(){ensureDirSync(e),ensureDirSync(join(e,"maps")),ensureDirSync(join(e,"other"));const t=readdirSync(join(n,"maps")).length,i=readdirSync(join(n,"other")).length,s=readdirSync(join(e,"maps")).length,a=readdirSync(join(e,"other")).length;return s===t&&a===i}())return;for(const t of readdirSync(join(n,"maps")))copyFileSync(join(n,"maps",t),join(e,"maps",t));for(const t of readdirSync(join(n,"other")))copyFileSync(join(n,"other",t),join(e,"other",t))}();const i=document.getElementById("content-container"),s=document.getElementById("search-input"),a=document.getElementById("replace-input"),r=document.getElementById("left-panel"),o=document.getElementById("search-results"),l=document.getElementById("search-content"),c=document.getElementById("replace-content"),d=document.getElementById("save-button"),m=document.getElementById("compile-button"),u=document.getElementById("case-button"),g=document.getElementById("whole-button"),p=document.getElementById("regex-button"),f=document.getElementById("translate-button"),v=document.getElementById("location-button"),h=document.getElementById("backup-check"),y=document.getElementById("backup-settings"),E=document.getElementById("backup-period-input"),x=document.getElementById("backup-max-input"),L=document.getElementById("goto-row-input"),b=new Map;let j,k,S;!async function e(){try{const e=JSON.parse(readFileSync(join(__dirname,"settings.json"),"utf8"));return j=e.backup.enabled,k=e.backup.period,void(S=e.backup.max)}catch(t){alert("Не удалось получить настройки.");await ipcRenderer.invoke("create-settings-file")&&e()}}();let w=!1,I=!1,_=!1,A=!1,$=!1,T=!1,B="main",M="main",C=!0;h.innerHTML=j?"check":"close",y.classList.toggle("hidden",!j),E.value=k,x.value=S,pathExistsSync(join(__dirname,"replacement-log.json"))||writeFileSync(join(__dirname,"replacement-log.json"),"{}","utf8"),ensureDirSync(t);let F=parseInt(function(){const e=readdirSync(t);return 0===e.length?"00":e.map((e=>e.slice(-2))).sort(((e,t)=>t-e))[0]}())+1;j&&J(k),function(){const t={originalMapText:join(e,"maps/maps.txt"),translatedMapText:join(e,"maps/maps_trans.txt"),originalMapNames:join(e,"maps/names.txt"),translatedMapNames:join(e,"maps/names_trans.txt"),originalActors:join(e,"other/Actors.txt"),translatedActors:join(e,"other/Actors_trans.txt"),originalArmors:join(e,"other/Armors.txt"),translatedArmors:join(e,"other/Armors_trans.txt"),originalClasses:join(e,"other/Classes.txt"),translatedClasses:join(e,"other/Classes_trans.txt"),originalCommonEvents:join(e,"other/CommonEvents.txt"),translatedCommonEvents:join(e,"other/CommonEvents_trans.txt"),originalEnemies:join(e,"other/Enemies.txt"),translatedEnemies:join(e,"other/Enemies_trans.txt"),originalItems:join(e,"other/Items.txt"),translatedItems:join(e,"other/Items_trans.txt"),originalSkills:join(e,"other/Skills.txt"),translatedSkills:join(e,"other/Skills_trans.txt"),originalSystem:join(e,"other/System.txt"),translatedSystem:join(e,"other/System_trans.txt"),originalTroops:join(e,"other/Troops.txt"),translatedTroops:join(e,"other/Troops_trans.txt"),originalWeapons:join(e,"other/Weapons.txt"),translatedWeapons:join(e,"other/Weapons_trans.txt")},n=[{id:"maps-content",original:"originalMapText",translated:"translatedMapText"},{id:"maps-names-content",original:"originalMapNames",translated:"translatedMapNames"},{id:"actors-content",original:"originalActors",translated:"translatedActors"},{id:"armors-content",original:"originalArmors",translated:"translatedArmors"},{id:"classes-content",original:"originalClasses",translated:"translatedClasses"},{id:"common-events-content",original:"originalCommonEvents",translated:"translatedCommonEvents"},{id:"enemies-content",original:"originalEnemies",translated:"translatedEnemies"},{id:"items-content",original:"originalItems",translated:"translatedItems"},{id:"skills-content",original:"originalSkills",translated:"translatedSkills"},{id:"system-content",original:"originalSystem",translated:"translatedSystem"},{id:"troops-content",original:"originalTroops",translated:"translatedTroops"},{id:"weapons-content",original:"originalWeapons",translated:"translatedWeapons"}],i=new Map;for(const[e,n]of Object.entries(t))i.set(e,readFileSync(n,"utf-8").split("\n"));for(const e of n)W(e.id,i.get(e.original),i.get(e.translated))}(),window.scrollTo(0,0),requestAnimationFrame((()=>{for(const e of i.children){e.classList.remove("hidden"),e.classList.add("flex","flex-col");const t=new Map,n=new Map;let i=0;for(const s of e.children){const{x:e,y:a}=s.getBoundingClientRect();n.set(s.id,e),t.set(s.id,a+i),i+=8}for(const i of e.children){const e=i.id;i.style.position="absolute",i.style.left=`${n.get(e)}px`,i.style.top=`${t.get(e)}px`,i.style.width="1840px",i.children[0].classList.add("hidden")}const s=Array.from(e.children).at(-1);e.style.height=t.get(s.id)-64+"px",e.classList.remove("flex","flex-col"),e.classList.add("hidden"),requestAnimationFrame((()=>{document.body.classList.remove("invisible")}))}}));const D=new IntersectionObserver((e=>{for(const t of e)t.isIntersecting?t.target.children[0].classList.remove("hidden"):t.target.children[0].classList.add("hidden")}));function O(e){e=e.trim();try{if(e.startsWith("/")){const t=e.indexOf("/"),n=e.lastIndexOf("/"),i=e.substring(t+1,n),s=e.substring(n+1);return new RegExp(i,s)}const t={text:w?e:I?`\\b${e}\\b`:e,attr:w||_?"g":"gi"};return new RegExp(t.text,t.attr)}catch(e){return void alert(`Неверное регулярное выражение: ${e}`)}}function H(e,t,n){const i="TEXTAREA"===n.tagName?n.value:n.innerHTML,s=i.match(t)||[];if(0===s.length)return;const a=[];let r=0;for(const e of s){const t=i.indexOf(e,r),n=t+e.length;a.push(`<div class="inline">${i.slice(r,t)}</div>`),a.push(`<div class="inline bg-gray-500">${e}</div>`),r=n}a.push(`<div class="inline">${i.slice(r)}</div>`),e.set(n,a.join(""))}function q(e){e=e.trim();const t=new Map,n=$?[...document.getElementById(`${B}-content`).children]:[...i.children].flatMap((e=>[...e.children])),s=O(e);if(s){for(const e of n){const n=e.children[0].children;H(t,s,n[2]),A||H(t,s,n[1])}return t}}function K(e=null,t=!0){function n(e=!0){e?"false"===o.getAttribute("moving")&&(o.classList.toggle("translate-x-full"),o.classList.toggle("translate-x-0"),o.setAttribute("moving",!0)):(o.classList.remove("translate-x-full"),o.classList.add("translate-x-0"),o.setAttribute("moving",!0));const t=document.getElementById("switch-search-content");function n(){if(l.classList.toggle("hidden"),l.classList.toggle("flex"),l.classList.toggle("flex-col"),c.classList.toggle("hidden"),c.classList.toggle("flex"),c.classList.toggle("flex-col"),"search"===t.innerHTML.trim()){t.innerHTML="menu_book";const n=JSON.parse(readFileSync(join(__dirname,"replacement-log.json"),"utf8"));for(const[i,s]of Object.entries(n)){const a=document.createElement("div");a.classList.add("text-white","text-xl","cursor-pointer","bg-gray-700","my-1","p-1","border-2","border-gray-600"),a.innerHTML=`<div class="text-base text-gray-400">${i}</div>\n                            <div class="text-base">${s.original}</div>\n                            <div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div>\n                            <div class="text-base">${s.translated}</div>`,c.appendChild(a)}function e(e){const t=e.target.parentElement;if(t.hasAttribute("reverted"))return;const i=document.getElementById(t.children[0].textContent);0===e.button?(z(i.parentElement.parentElement.parentElement.id.replace("-content",""),!1),requestAnimationFrame((()=>{requestAnimationFrame((()=>{i.parentElement.parentElement.scrollIntoView({block:"center",inline:"center"})}))}))):2===e.button&&(i.value=t.children[1].textContent,t.innerHTML=`<div class="inline text-base">Текст на позиции\n<code class="inline">${t.children[0].textContent}</code>\nбыл возвращён к исходному значению\n<code class="inline">${t.children[1].textContent}</code></div>`,t.setAttribute("reverted",""),delete n[i.id],writeFileSync(join(__dirname,"replacement-log.json"),JSON.stringify(n,null,4),"utf8"))}c.addEventListener("mousedown",(t=>{e(t)}))}else t.innerHTML="search",c.innerHTML="",c.removeEventListener("mousedown",(t=>{e(t)}))}let i;if(l.children.length>0&&(i=document.createElement("div"),i.classList.add("flex","justify-center","items-center","h-full","w-full"),i.innerHTML=o.classList.contains("translate-x-0")?'<div class="text-4xl animate-spin font-material">refresh</div>':"",l.appendChild(i)),"false"===o.getAttribute("shown"))o.addEventListener("transitionend",(()=>{for(const e of l.children)e.classList.toggle("hidden");i&&l.removeChild(i),t.addEventListener("click",n),o.setAttribute("shown","true"),o.setAttribute("moving",!1)}),{once:!0});else{if(o.classList.contains("translate-x-full"))return o.setAttribute("shown","false"),o.setAttribute("moving",!0),t.removeEventListener("click",n),void o.addEventListener("transitionend",(()=>{o.setAttribute("moving",!1)}),{once:!0});for(const e of l.children)e.classList.toggle("hidden");i&&l.removeChild(i),o.setAttribute("moving",!1)}}if(!e)return void n(t);function i(e){const t=e.id.split("-");return[t[t.length-2],t[t.length-1]]}if(!(e=e.trim()))return;const s=q(e);if(!s||0===s.size)return l.innerHTML='<div class="flex justify-center items-center h-full">Нет совпадений</div>',void n(t);for(const[e,t]of s){const n=document.createElement("div");n.classList.add("text-white","text-xl","cursor-pointer","bg-gray-700","my-1","p-1","border-2","border-gray-600","hidden");const s=e.parentElement.parentElement.parentElement,[a,o]=(r=e.id).includes("original")?[document.getElementById(r.replace("original","translated")),1]:[document.getElementById(r.replace("translated","original")),0],[c,d]=i(e),[m,u]=i(a);n.innerHTML=`\n\t\t\t\t\t<div class="text-base">${t}</div>\n\t\t\t\t\t<div class="text-xs text-gray-400">${e.parentElement.parentElement.id.slice(0,e.parentElement.parentElement.id.lastIndexOf("-"))} - ${c} - ${d}</div>\n\t\t\t\t\t<div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div>\n\t\t\t\t\t<div class="text-base">${"TEXTAREA"===a.tagName?a.value:a.innerHTML}</div>\n\t\t\t\t\t<div class="text-xs text-gray-400">${a.parentElement.parentElement.id.slice(0,a.parentElement.parentElement.id.lastIndexOf("-"))} - ${m} - ${u}</div>\n\t\t\t\t`,n.setAttribute("data",`${s.id},${e.id},${o}`),l.appendChild(n)}var r;function d(e){const t=e.target.parentElement.hasAttribute("data")?e.target.parentElement:e.target.parentElement.parentElement,[n,i,s]=t.getAttribute("data").split(",");!function(e,t,n,i,s){if(0===e.button)z(t.id.replace("-content",""),!1),requestAnimationFrame((()=>{requestAnimationFrame((()=>{n.parentElement.parentElement.scrollIntoView({block:"center",inline:"center"})}))}));else if(2===e.button){if(n.id.includes("original"))return void alert("Оригинальные строки не могут быть заменены.");if(a.value.trim()){const e=N(n);if(e){const t=1===s?3:0;i.children[t].innerHTML=e}}}}(e,document.getElementById(n),document.getElementById(i),t,parseInt(s))}n(t),l.removeEventListener("mousedown",(e=>{d(e)})),l.addEventListener("mousedown",(e=>{d(e)}))}function N(e,t=!1){if(!t){const t=O(s.value),n=a.value,i=`<div class="inline bg-red-600">${n}</div>`,r=e.value.split(t),o=r.flatMap(((e,t)=>[e,t<r.length-1?i:""])),l=r.join(n);b.set(e.id,{original:e.value,translated:l});const c={...JSON.parse(readFileSync(join(__dirname,"replacement-log.json"),"utf8")),...Object.fromEntries([...b])};return writeFileSync(join(__dirname,"replacement-log.json"),JSON.stringify(c,null,4),"utf8"),b.clear(),e.value=l,o.join("")}if(!(e=e.trim()))return;const n=q(e);if(!n||0===n.size)return;const i=O(e);if(!i)return;for(const e of n.keys())if(!e.id.includes("original")){const t=e.value.replace(i,a.value);b.set(e.id,{original:e.value,translated:t}),e.value=t}const r={...JSON.parse(readFileSync(join(__dirname,"replacement-log.json"),"utf8")),...Object.fromEntries([...b])};writeFileSync(join(__dirname,"replacement-log.json"),JSON.stringify(r,null,4),"utf8"),b.clear()}function R(n=!1){const s={"maps-content":"./maps/maps_trans.txt","maps-names-content":"./maps/names_trans.txt","actors-content":"./other/Actors_trans.txt","armors-content":"./other/Armors_trans.txt","classes-content":"./other/Classes_trans.txt","common-events-content":"./other/CommonEvents_trans.txt","enemies-content":"./other/Enemies_trans.txt","items-content":"./other/Items_trans.txt","skills-content":"./other/Skills_trans.txt","system-content":"./other/System_trans.txt","troops-content":"./other/Troops_trans.txt","weapons-content":"./other/Weapons_trans.txt"};d.classList.add("animate-spin"),requestAnimationFrame((()=>{let a=e;if(n){const e=new Date,n={year:e.getFullYear(),month:e.getMonth()+1,day:e.getDate(),hour:e.getHours(),minute:e.getMinutes(),second:e.getSeconds()};for(const[e,t]of Object.entries(n))n[e]=t.toString().padStart(2,"0");99===F&&(F=1);const i=`${Object.values(n).join("-")}_${F.toString().padStart(2,"0")}`;F++,a=join(t,i),ensureDirSync(join(a,"maps"),{recursive:!0}),ensureDirSync(join(a,"other"),{recursive:!0})}for(const e of i.children){const t=[];for(const n of e.children){const e=n.children[0].children[2];t.push(e.value.replaceAll("\n","\\n"))}const i=s[e.id];if(i){const e=join(a,i);writeFileSync(e,t.join("\n"),"utf8"),n||(C=!0)}}setTimeout((()=>{d.classList.remove("animate-spin")}),1e3)}))}function J(e){j&&setTimeout((()=>{j&&(R(!0),J(e))}),1e3*e)}function W(e,t,n){const s=document.createElement("div");s.id=e,s.classList.add("hidden");for(const[i,a]of t.entries()){const t=document.createElement("div");t.id=`${e}-${i}`,t.classList.add("w-full","z-10");const r=document.createElement("div");r.classList.add("flex","flex-row");const o=document.createElement("div");o.id=`${e}-original-${i}`,o.textContent=a.replaceAll("\\n","\n"),o.classList.add(..."p-1 w-full h-auto text-xl bg-gray-800 outline outline-2 outline-gray-700 mr-2 inline-block whitespace-pre-wrap".split(" "));const l=document.createElement("textarea"),c=n[i].split("\\n");l.id=`${e}-translated-${i}`,l.rows=c.length,l.value=c.join("\n"),l.classList.add(..."p-1 w-full h-auto text-xl bg-gray-800 resize-none outline outline-2 outline-gray-700 focus:outline-gray-400".split(" "));const d=document.createElement("div");d.id=`${e}-row-${i}`,d.textContent=i,d.classList.add(..."p-1 w-36 h-auto text-xl bg-gray-800 outline-none".split(" ")),r.appendChild(d),r.appendChild(o),r.appendChild(l),t.appendChild(r),s.appendChild(t)}i.appendChild(s)}function z(e,t=!0){if(B!==e)if("main"===e){B="main",document.getElementById("current-state").innerHTML="",pageLoadedDisplay.innerHTML="check_indeterminate_small";for(const e of i.children)e.classList.remove("flex","flex-col"),e.classList.add("hidden")}else M=B,B=e,function(e,t,n=!0){const i=document.getElementById("current-state"),s=document.getElementById("is-loaded");requestAnimationFrame((()=>{s.innerHTML="refresh",s.classList.toggle("animate-spin"),i.innerHTML=e,requestAnimationFrame((()=>{const e=document.getElementById(t);e.classList.remove("hidden"),e.classList.add("flex","flex-col"),"main"!==M&&(document.getElementById(`${M}-content`).classList.remove("flex","flex-col"),document.getElementById(`${M}-content`).classList.add("hidden"),D.disconnect());for(const t of e.children)D.observe(t);n&&(r.classList.toggle("translate-x-0"),r.classList.toggle("-translate-x-full")),s.innerHTML="done",s.classList.toggle("animate-spin")}))}))}(e,`${e}-content`,t)}function V(e){const t=document.activeElement;if(!t||!t.id||"alt"!==e&&"ctrl"!==e)return;const n=t.id.split("-"),i=parseInt(n.pop(),10),s=n.join("-");if(isNaN(i))return;const a="alt"===e?1:-1,r=`${s}-${i+a}`,o=document.getElementById(r);if(!o)return;const l=o.clientHeight+8;window.scrollBy(0,a*l),t.blur(),o.focus(),o.setSelectionRange(0,0)}function X(e){switch(e.code){case"Escape":document.activeElement.blur();break;case"Enter":e.altKey?V("alt"):e.ctrlKey&&V("ctrl");break;case"KeyS":e.ctrlKey&&R();break;case"KeyF":e.ctrlKey&&s.focus();break;case"KeyC":e.altKey&&G();break;case"KeyG":e.ctrlKey&&"main"!==B&&(L.classList.contains("hidden")?function(){L.classList.remove("hidden"),L.focus();const e=document.getElementById(`${B}-content`),t=e.children[e.children.length-1],n=t.id.slice(t.id.lastIndexOf("-")+1);L.placeholder=`Перейти к строке... от 0 до ${n}`,L.addEventListener("keydown",(function e(t){if("Enter"===t.code){const t=L.value,n=document.getElementById(`${B}-content-${t}`);n&&n.scrollIntoView({block:"center",inline:"center"}),L.value="",L.classList.add("hidden"),L.removeEventListener("keydown",e)}"Escape"===t.code&&(L.value="",L.classList.add("hidden"),L.removeEventListener("keydown",e))}))}():L.classList.add("hidden"))}}function G(){m.classList.add("animate-spin");const e=fork(join(__dirname,"../resources/write.js"),[],{timeout:15e3});e.on("error",(t=>{alert(`Не удалось записать файлы: ${t}`),e.kill()})),e.on("close",(()=>{m.classList.remove("animate-spin"),alert("Все файлы записаны успешно.")}))}document.addEventListener("keydown",(e=>{document.activeElement===document.body&&function(e){switch(e.code){case"Escape":z("main",!1);break;case"Tab":r.classList.toggle("translate-x-0"),r.classList.toggle("-translate-x-full");break;case"KeyR":K();break;case"Digit1":z("maps",!1);break;case"Digit2":z("maps-names",!1);break;case"Digit3":z("actors",!1);break;case"Digit4":z("armors",!1);break;case"Digit5":z("classes",!1);break;case"Digit6":z("common-events",!1);break;case"Digit7":z("enemies",!1);break;case"Digit8":z("items",!1);break;case"Digit9":z("skills",!1);break;case"Digit0":z("system",!1);break;case"Minus":z("troops",!1);break;case"Equal":z("weapons",!1)}}(e),X(e)})),s.addEventListener("keydown",(e=>{!function(e){"Enter"===e.code&&(e.preventDefault(),e.ctrlKey?s.value+="\n":s.value.trim()?(l.innerHTML="",K(s.value,!1)):l.innerHTML='<div class="flex justify-center items-center h-full">Результатов нет</div>')}(e)})),r.addEventListener("click",(e=>{z(e.target.id)})),document.getElementById("menu-button").addEventListener("click",(()=>{r.classList.toggle("translate-x-0"),r.classList.toggle("-translate-x-full")})),document.getElementById("search-button").addEventListener("click",(()=>{s.value?(l.innerHTML="",K(s.value,!1)):document.activeElement===document.body&&s.focus()})),document.getElementById("replace-button").addEventListener("click",(()=>{s.value&&a.value&&N(s.value,!0)})),u.addEventListener("click",(()=>{w||(_=!_,u.classList.toggle("bg-gray-500"))})),g.addEventListener("click",(()=>{w||(I=!I,g.classList.toggle("bg-gray-500"))})),p.addEventListener("click",(()=>{w=!w,_=!1,u.classList.remove("bg-gray-500"),I=!1,g.classList.remove("bg-gray-500"),p.classList.toggle("bg-gray-500")})),f.addEventListener("click",(()=>{A=!A,f.classList.toggle("bg-gray-500")})),v.addEventListener("click",(()=>{$=!$,v.classList.toggle("bg-gray-500")})),d.addEventListener("click",R),m.addEventListener("click",G),document.getElementById("options-button").addEventListener("click",(function(){function e(){j=!j,j?(y.classList.remove("hidden"),J(k)):y.classList.add("hidden"),h.innerHTML="close"}function t(){k=parseInt(E.value),E.value=k<60?60:k>3600?3600:k}function n(){S=parseInt(x.value),x.value=S<1?1:S>100?100:S}if(T=!T,document.getElementById("options-menu").classList.toggle("hidden"),T)document.body.classList.add("overflow-hidden"),h.addEventListener("click",e),E.addEventListener("change",t),x.addEventListener("change",n);else{document.body.classList.remove("overflow-hidden"),h.removeEventListener("click",e),E.removeEventListener("change",t),x.removeEventListener("change",n);const i={backup:{enabled:j,period:k,max:S}};writeFileSync(join(__dirname,"settings.json"),JSON.stringify(i,null,4),"utf-8")}})),document.addEventListener("keydown",(e=>{switch(e.key){case"Tab":case e.altKey:e.preventDefault();break;case e.altKey:if(e.preventDefault(),C)return void ipcRenderer.send("quit");ipcRenderer.invoke("quit-confirm").then((e=>e?(R(),void setTimeout((()=>{ipcRenderer.send("quit")}),1e3)):void 0));break;case"F5":e.preventDefault(),document.body.classList.add("hidden"),requestAnimationFrame((()=>{location.reload()}));break;default:C&&document.activeElement!==document.body&&document.activeElement!==s&&document.activeElement!==a&&(C=!1)}}))}document.addEventListener("DOMContentLoaded",render);