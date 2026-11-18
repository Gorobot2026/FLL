/* BIOGENESIS X3 · GitHub Pages frontend. NEVER put secrets in JavaScript source. */
const $ = id => document.getElementById(id);
const ESC = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={password:'',data:null,busy:false,lastRefresh:null};
const SCREEN_NAMES={overview:'ภาพรวมระบบ',mixer:'เครื่องผสมดิน',capsules:'แคปซูลเมล็ด',greenhouse:'โรงเรือน 3 ชั้น',experiments:'บันทึกการทดลอง',insights:'วิเคราะห์ข้อมูล',schedules:'ตั้งเวลารดน้ำ',connection:'การเชื่อมต่อ'};
const API=String(window.X3_API_BASE||'').replace(/\/$/,'')+'/api';
const fmtNum=(value,d=1)=>value===''||value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(d);
const asBool=v=>v===true||String(v)==='true';
function toast(message,bad=false){const e=$('toast');e.textContent=message;e.className=(bad?'bad ':'')+'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.className='',4200);}
function go(id){document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id===id));document.querySelectorAll('.nav-btn').forEach(e=>e.classList.toggle('active',e.dataset.screen===id));$('crumb').textContent=SCREEN_NAMES[id];window.scrollTo(0,0);}
async function call(action,data={}){
 if(!state.password)throw Error('กรุณากด เข้าสู่ระบบ ก่อน');
 if(API.includes('YOUR_WORKER'))throw Error('ต้องใส่ URL Cloudflare Worker ใน config.js ก่อน');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-Operator-Key':state.password},body:JSON.stringify({action,data}),signal:controller.signal,cache:'no-store'});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||('HTTP '+response.status));
  return result.data;
 }catch(e){throw Error(e.name==='AbortError'?'เชื่อมต่อเกินเวลา กรุณาตรวจระบบ':e.message);}
 finally{clearTimeout(timeout);}
}
async function refresh(){
 if(!state.password)return;
 try{const data=await call('bootstrap');state.data=data;state.lastRefresh=Date.now();render();$('statusText').textContent='เชื่อมต่อ Database แล้ว';$('statusDot').classList.add('on');}
 catch(e){$('statusText').textContent='เชื่อมต่อไม่สำเร็จ';$('statusDot').classList.remove('on');toast(e.message,true);throw e;}
}
async function invoke(action,data,message='บันทึกคำสั่งแล้ว'){
 if(state.busy)return;
 state.busy=true;
 try{const result=await call(action,data);toast(message+(result&&result.id?' · #'+result.id:''));await refresh();return result;}
 catch(e){toast(e.message,true);}finally{state.busy=false;}
}
function render(){const d=state.data;if(!d)return;
 $('metricRecipes').textContent=d.recipes.length;
 $('metricExperiments').textContent=d.experiments.length;
 const cmd=d.commands[0];$('metricCommand').textContent=cmd?String(cmd.status).toUpperCase():'—';
 const online=d.zones.filter(z=>z.lastSeen&&Date.now()-Date.parse(z.lastSeen)<180000).length;
 $('metricOnline').textContent=online+'/3';
 $('commandList').innerHTML=d.commands.length?`<table class="table"><thead><tr><th>ID</th><th>อุปกรณ์</th><th>คำสั่ง</th><th>สถานะ</th></tr></thead><tbody>${d.commands.map(c=>`<tr><td>${ESC(String(c.id).slice(0,12))}</td><td>${ESC(c.device)}</td><td>${ESC(c.action)}</td><td><strong>${ESC(c.status)}</strong></td></tr>`).join('')}</tbody></table>`:'<div class="empty">ยังไม่มีคำสั่ง</div>'; 
 $('configuredUrl').textContent=API;
 $('overviewZones').innerHTML=d.zones.map(z=>`<div class="zone-row"><div><strong>ชั้น ${ESC(z.zone)} · ${['Cool','Mild','Warm'][Number(z.zone)-1]||'Climate'}</strong><small>${z.lastSeen&&Date.now()-Date.parse(z.lastSeen)<180000?'ออนไลน์':'ไม่มีข้อมูลใหม่'} · เป้าหมาย ${fmtNum(z.targetC)}°C</small></div><b>${asBool(z.sensorOk)?fmtNum(z.tempC)+'°C':'—'}</b></div>`).join('');
 $('recipeList').innerHTML=d.recipes.length?`<table class="table"><thead><tr><th>ชื่อสูตร</th><th>น้ำหนักรวม</th><th>เลือก</th></tr></thead><tbody>${d.recipes.slice().reverse().map(r=>`<tr><td><strong>${ESC(r.name)}</strong><br><small>${ESC(r.id)}</small></td><td>${[r.g1,r.g2,r.g3,r.g4].reduce((a,b)=>a+Number(b),0)} g</td><td><button class="mini" data-recipe="${ESC(r.id)}">ใช้สูตร</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">ยังไม่มีสูตร</div>';
 $('capsuleList').innerHTML=d.capsules.length?`<table class="table"><thead><tr><th>เวลา</th><th>สูตร</th><th>ประเภท</th><th>จำนวน</th></tr></thead><tbody>${d.capsules.map(r=>`<tr><td>${ESC(String(r.at).slice(0,16))}</td><td>${ESC(r.recipeId)}</td><td>${ESC(r.capsuleType)}</td><td>${ESC(r.count)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">ยังไม่มีบันทึกแคปซูล</div>';
 $('experimentList').innerHTML=d.experiments.length?`<table class="table"><thead><tr><th>พืช</th><th>สูตร / ชั้น</th><th>อัตรางอก</th></tr></thead><tbody>${d.experiments.map(r=>`<tr><td><strong>${ESC(r.plant)}</strong></td><td>${ESC(r.recipeId)} / ${ESC(r.zone)}</td><td>${Math.round(Number(r.sprouted)/Number(r.seeds)*100)}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">ยังไม่มีข้อมูลทดลอง</div>';
 $('insightChart').innerHTML=d.experiments.length?d.experiments.slice(0,16).map(r=>{const p=Math.round(Number(r.sprouted)/Number(r.seeds)*100);return `<div class="bar-item"><div class="bar-label" title="${ESC(r.plant)}">${ESC(r.plant)} · ${ESC(r.recipeId)}</div><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><div class="bar-value">${p}%</div></div>`;}).join(''):'<div class="empty">บันทึกผลทดลองอย่างน้อย 1 รายการเพื่อดูกราฟ</div>';
 renderGreenhouse(d.zones);renderSchedules(d.schedules);
}
function renderGreenhouse(zones){
 $('greenhouseCards').innerHTML=zones.map(z=>{
 const i=Number(z.zone),online=z.lastSeen&&Date.now()-Date.parse(z.lastSeen)<180000;
 return `<article class="zone-card"><div class="zone-top"><h2>🌿 ห้องทดลองชั้น ${i}</h2><span class="pill ${online?'':'amber'}">${online?'รับข้อมูลแล้ว':'ออฟไลน์ / รอข้อมูล'}</span></div><div class="temp">${asBool(z.sensorOk)?fmtNum(z.tempC):'—'}<small> °C ปัจจุบัน</small></div><div class="sensor-grid"><div class="sensor"><small>ความชื้นอากาศ</small><b>${asBool(z.sensorOk)?fmtNum(z.humidity):'—'} %RH</b></div><div class="sensor"><small>ความชื้นวัสดุปลูก</small><b>${fmtNum(z.soilPct,0)} %</b></div><div class="sensor"><small>พัดลม / ชุดเย็น</small><b>${asBool(z.fan)?'ON':'OFF'} / ${asBool(z.cool)?'ON':'OFF'}</b></div><div class="sensor"><small>ปั๊ม / ฮีตเตอร์</small><b>${asBool(z.pump)?'ON':'OFF'} / ${asBool(z.heat)?'ON':'OFF'}</b></div></div><form class="zone-settings" data-zone="${i}"><label>อุณหภูมิเป้าหมาย (18–35°C)<input name="targetC" type="number" step="0.5" min="18" max="35" value="${ESC(z.targetC)}" required></label><label>จุดเริ่มรดน้ำอัตโนมัติ (% ดิน)<input name="soilThreshold" type="number" min="10" max="90" value="${ESC(z.soilThreshold)}" required></label><label class="checkline"><input type="checkbox" name="tempAuto" ${asBool(z.tempAuto)?'checked':''}> ควบคุมอุณหภูมิอัตโนมัติ</label><label class="checkline"><input type="checkbox" name="soilAuto" ${asBool(z.soilAuto)?'checked':''}> รดน้ำเมื่อดินแห้ง (อัตโนมัติ)</label><button class="btn btn-primary" type="submit">บันทึกค่าชั้น ${i}</button><button type="button" class="btn btn-outline water-now" data-zone="${i}">รดน้ำชั้น ${i} · 3 วินาที</button></form></article>`;
 }).join('');
}
function renderSchedules(arr){
 $('scheduleCards').innerHTML=arr.map(s=>`<form class="schedule-card" data-zone="${ESC(s.zone)}"><strong>ชั้น ${ESC(s.zone)}</strong><label class="checkline"><input name="enabled" type="checkbox" ${asBool(s.enabled)?'checked':''}> เปิดตารางเวลานี้</label><div class="fields-2"><label>ชั่วโมง (0–23)<input name="hour" type="number" value="${ESC(s.hour)}" min="0" max="23" required></label><label>นาที (0–59)<input name="minute" type="number" value="${ESC(s.minute)}" min="0" max="59" required></label></div><label>รดน้ำ (วินาที)<input name="seconds" type="number" value="${ESC(s.seconds)}" min="1" max="10" required></label><button class="btn btn-primary" type="submit">บันทึกตารางชั้น ${ESC(s.zone)}</button></form>`).join('');
}
function weights(){const out={};for(let i=1;i<=4;i++)out['g'+i]=Number($('g'+i).value);return out;}
function updateTotal(){$('totalGrams').textContent=Object.values(weights()).reduce((a,b)=>a+b,0).toLocaleString()+' กรัม';}
function bind(){
 document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>go(b.dataset.screen)));
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
 document.querySelectorAll('.refresh').forEach(b=>b.addEventListener('click',()=>refresh().catch(()=>{})));
 $('connectBtn').addEventListener('click',()=>{$('operatorPassword').value='';$('loginDialog').showModal();});
 $('cancelLogin').addEventListener('click',()=>$('loginDialog').close());
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();state.password=$('operatorPassword').value;$('operatorPassword').value='';$('loginDialog').close();try{await refresh();toast('เชื่อมต่อ Google Sheets สำเร็จ');}catch(e){state.password='';}});
 [1,2,3,4].forEach(i=>$('g'+i).addEventListener('input',updateTotal));
 $('saveRecipe').addEventListener('click',()=>invoke('saveRecipe',{name:$('recipeName').value,...weights()},'บันทึกสูตรดินแล้ว'));
 $('mixForm').addEventListener('submit',e=>{e.preventDefault();if(confirm('ยืนยันส่งคำสั่งผสมดินไปยัง ESP32? ต้อง ARM ที่เครื่องและตรวจฝาครอบก่อน'))invoke('mix',weights(),'เข้าคิวผสมดินแล้ว');});
 $('stopMixer').addEventListener('click',()=>{if(confirm('ส่งคำสั่งหยุดผ่านอินเทอร์เน็ต (ไม่ใช่ปุ่มฉุกเฉิน) ?'))invoke('stop',{device:'mixer'},'ส่งคำสั่งหยุดเครื่องผสมแล้ว');});
 $('stopGreenhouse').addEventListener('click',()=>{if(confirm('ส่งคำสั่งหยุดโรงเรือน (ไม่ใช่ E-STOP) ?'))invoke('stop',{device:'greenhouse'},'ส่งคำสั่งหยุดโรงเรือนแล้ว');});
 $('recipeList').addEventListener('click',e=>{const b=e.target.closest('[data-recipe]');if(!b||!state.data)return;const r=state.data.recipes.find(x=>x.id===b.dataset.recipe);if(!r)return;for(let i=1;i<=4;i++)$('g'+i).value=r['g'+i];$('recipeName').value=r.name;updateTotal();toast('เลือกสูตร '+r.name);});
 $('greenhouseCards').addEventListener('submit',e=>{if(!e.target.matches('form[data-zone]'))return;e.preventDefault();const f=e.target,fd=new FormData(f);invoke('setZone',{zone:Number(f.dataset.zone),targetC:Number(fd.get('targetC')),soilThreshold:Number(fd.get('soilThreshold')),tempAuto:fd.has('tempAuto'),soilAuto:fd.has('soilAuto')},'บันทึกเป้าหมายโรงเรือนแล้ว');});
 $('greenhouseCards').addEventListener('click',e=>{const b=e.target.closest('.water-now');if(b&&confirm('สั่งรดน้ำจริง 3 วินาทีที่ชั้น '+b.dataset.zone+'?'))invoke('water',{zone:Number(b.dataset.zone),seconds:3},'เข้าคิวรดน้ำแล้ว');});
 $('scheduleCards').addEventListener('submit',e=>{if(!e.target.matches('form[data-zone]'))return;e.preventDefault();const f=e.target,fd=new FormData(f);invoke('saveSchedule',{zone:Number(f.dataset.zone),enabled:fd.has('enabled'),hour:Number(fd.get('hour')),minute:Number(fd.get('minute')),seconds:Number(fd.get('seconds'))},'บันทึกตารางเวลาแล้ว');});
 $('capsuleForm').addEventListener('submit',e=>{e.preventDefault();invoke('addCapsule',{recipeId:$('capRecipe').value,capsuleType:$('capType').value,count:Number($('capCount').value),notes:$('capNotes').value},'บันทึกแคปซูลแล้ว');});
 $('experimentForm').addEventListener('submit',e=>{e.preventDefault();invoke('addExperiment',{plant:$('xpPlant').value,recipeId:$('xpRecipe').value,capsule:$('xpCapsule').value,zone:Number($('xpZone').value),seeds:Number($('xpSeeds').value),sprouted:Number($('xpSprouted').value),heightCm:Number($('xpHeight').value),notes:$('xpNotes').value},'บันทึกผลทดลองแล้ว');});
 $('apiPing').addEventListener('click',()=>refresh().catch(()=>{}));
 setInterval(()=>{if(state.password&&!document.hidden)refresh().catch(()=>{});},20000);
 $('configuredUrl').textContent=API;
}
bind();updateTotal();
