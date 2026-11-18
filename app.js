/* BIOGENESIS X3 front-end starter — SIMULATION ONLY.
   No MQTT, HTTP, Firebase or ESP32 connection is made by this file.
   Review README.md and API_SPEC.md before integrating actual hardware.
*/
(() => {
  'use strict';
  const KEY = 'biogenesis-x3-demo-v1';
  const defaults = {
    recipes: [
      {id:'salad',name:'สูตรผักสลัด',weights:[400,250,200,150]},
      {id:'herbs',name:'สูตรสมุนไพร',weights:[350,350,200,100]},
      {id:'flowers',name:'สูตรไม้ดอก',weights:[300,300,250,150]}
    ],
    selectedRecipe:'salad',
    floors:[
      {id:1,temp:25.4,humidity:66,soil:52,target:25,fan:false,water:false,auto:true},
      {id:2,temp:27.2,humidity:61,soil:48,target:28,fan:false,water:false,auto:true},
      {id:3,temp:30.8,humidity:72,soil:63,target:31,fan:false,water:false,auto:true}
    ],
    schedules:[], logs:[], experiments:[], capsuleBatches:[]
  };
  const copy = x => JSON.parse(JSON.stringify(x));
  function load(){ try {
    const saved=JSON.parse(localStorage.getItem(KEY));
    if (!saved || !Array.isArray(saved.recipes)||!Array.isArray(saved.floors)||saved.floors.length!==3) return copy(defaults);
    return {...copy(defaults),...saved};
  }catch{return copy(defaults)} }
  let state=load();
  state.experiments=Array.isArray(state.experiments)?state.experiments:[];
  state.capsuleBatches=Array.isArray(state.capsuleBatches)?state.capsuleBatches:[];
  state.floors=state.floors.map((f,i)=>({...{targetRH:[60,65,70][i],lightHours:12,profile:['cool','mild','warm'][i],cooling:false},...f}));
  let mixTimer=null, mixProgress=0, mixActive=false, mixPhase='พร้อมรับคำสั่ง', lastPayload=null, toastTimer=null;
  const $=id=>document.getElementById(id);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0));
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v).toLocaleString('th-TH',{maximumFractionDigits:1});
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
  const now=()=>new Date().toLocaleString('th-TH',{hour12:false,timeZone:'Asia/Bangkok'});
  function banner(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
  function addLog(text){state.logs.unshift({time:now(),text});state.logs=state.logs.slice(0,30);save();renderLog()}
  function publishDemo(device,action,parameters){
    lastPayload={command_id:'demo-'+Date.now(),issued_at:new Date().toISOString(),device,action,parameters,mode:'SIMULATION_ONLY'};
    $('payloadView').textContent=JSON.stringify(lastPayload,null,2);
    addLog(`จำลองคำสั่ง ${action} → ${device}`);
    return lastPayload;
  }
  function page(name){
    const names={overview:['ภาพรวมระบบอัจฉริยะ','OVERVIEW'],soil:['เครื่องผสมดิน','SOIL MIXER'],capsule:['เครื่องทำแคปซูลเมล็ดพันธุ์','SEED CAPSULE'],greenhouse:['โรงเรือนอัจฉริยะ 3 ชั้น','GREENHOUSE'],experiments:['แผนและผลการทดลอง','EXPERIMENTS'],insights:['วิเคราะห์ข้อมูล','DATA LEARNING'],schedule:['ตั้งเวลาทำงาน','SCHEDULES'],developer:['ข้อมูลเชื่อมต่อ','DEVELOPER']};
    document.querySelectorAll('.page').forEach(x=>x.classList.toggle('show',x.id===`page-${name}`));
    document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
    $('pageTitle').textContent=names[name][0];$('pageCrumb').textContent=names[name][1];
    $('sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.go)));
  $('menuToggle').onclick=()=>$('sidebar').classList.toggle('open');
  function renderLog(){ $('activityLog').innerHTML=state.logs.length?state.logs.map(l=>`<div class="log-entry"><b>${escapeHtml(l.text)}</b><span>${escapeHtml(l.time)}</span></div>`).join(''):'<div class="empty">ยังไม่มีประวัติการสั่งงาน</div>' }
  $('clearLog').onclick=()=>{state.logs=[];save();renderLog()};
  function recipe(){return state.recipes.find(r=>r.id===state.selectedRecipe)||state.recipes[0]}
  function renderRecipes(){
    $('recipeCount').textContent=state.recipes.length;
    $('recipeCards').innerHTML=state.recipes.map(r=>`<div class="recipe-card ${r.id===state.selectedRecipe?'selected':''}"><div class="recipe-head"><span class="pill">${r.id===state.selectedRecipe?'✓ เลือกอยู่':'สูตรบันทึกแล้ว'}</span><span>🌱</span></div><h3>${escapeHtml(r.name)}</h3><p>วัตถุดิบ ${r.weights.map(n=>num(n)).join(' / ')} g</p><p>น้ำหนักรวม <b>${num(r.weights.reduce((a,b)=>a+b,0))} กรัม</b></p><div class="card-actions"><button class="primary" data-recipe-select="${escapeHtml(r.id)}">ใช้สูตรนี้</button><button class="secondary" data-recipe-edit="${escapeHtml(r.id)}">แก้ไข</button></div></div>`).join('');
    $('recipeSelect').innerHTML=state.recipes.map(r=>`<option value="${escapeHtml(r.id)}" ${r.id===state.selectedRecipe?'selected':''}>${escapeHtml(r.name)}</option>`).join('');
    updateWeights();renderScheduleTargets();renderCapsuleSelect();renderExperimentRecipeSelect();
  }
  function updateWeights(){const r=recipe();if(!r)return;let mult=clamp($('batchMultiplier').value,1,20);$('recipeWeights').innerHTML=r.weights.map((v,i)=>`<div class="weight-row"><span>ถังวัตถุดิบ ${i+1}</span><b>${num(v*mult)} g</b></div>`).join('');$('totalWeight').textContent=num(r.weights.reduce((a,b)=>a+b,0)*mult)+' g'}
  $('recipeSelect').onchange=e=>{state.selectedRecipe=e.target.value;save();renderRecipes()};
  $('batchMultiplier').oninput=updateWeights;
  $('recipeCards').onclick=e=>{const s=e.target.closest('[data-recipe-select]'),ed=e.target.closest('[data-recipe-edit]');if(s){state.selectedRecipe=s.dataset.recipeSelect;save();renderRecipes();banner('เลือกสูตรเรียบร้อย (จำลอง)')}if(ed)openRecipe(ed.dataset.recipeEdit)};
  function openRecipe(id){let r=id?state.recipes.find(x=>x.id===id):null;$('recipeEditId').value=r?.id||'';$('recipeName').value=r?.name||'';[1,2,3,4].forEach((i)=>{$('g'+i).value=r?.weights[i-1]??[400,250,200,150][i-1]});$('recipeDialog').showModal()}
  $('newRecipe').onclick=()=>openRecipe();$('closeRecipe').onclick=$('cancelRecipe').onclick=()=>$('recipeDialog').close();
  $('recipeForm').addEventListener('submit',e=>{
    e.preventDefault();const weights=[1,2,3,4].map(i=>Number($('g'+i).value));
    if(weights.some(w=>!Number.isFinite(w)||w<0||w>100000)||weights.reduce((a,b)=>a+b,0)<=0){banner('กรุณากรอกน้ำหนักที่ถูกต้อง');return}
    const id=$('recipeEditId').value||'r'+Date.now();const r={id,name:$('recipeName').value.trim(),weights};if(!r.name)return;
    const idx=state.recipes.findIndex(x=>x.id===id);if(idx>=0)state.recipes[idx]=r;else state.recipes.push(r);
    state.selectedRecipe=id;save();renderRecipes();$('recipeDialog').close();banner('บันทึกสูตรแล้ว (เฉพาะเบราว์เซอร์นี้)')
  });
  function setMix(p,phase){mixProgress=p;mixPhase=phase;$('mixBar').style.width=p+'%';$('overviewSoilBar').style.width=p+'%';$('mixPercent').textContent=p+'%';$('overviewSoilPercent').textContent=p+'% (จำลอง)';$('mixStatus').textContent=phase;$('overviewSoilStatus').textContent=phase;$('mixStatusPill').textContent=mixActive?'RUNNING':p===100?'COMPLETE':'IDLE';
    const step=p<65?1:p<88?2:p<100?3:4;
    [1,2,3,4].forEach(i=>{$('step'+i).classList.toggle('active',p>0&&i===step);$('bin'+i).classList.toggle('active',p>0&&p<65&&i===Math.max(1,Math.ceil(p/16.25)))});
  }
  $('startMix').onclick=()=>{
    if(mixActive){banner('กำลังผสมอยู่');return}const r=recipe();if(!r){banner('ยังไม่มีสูตร');return}
    const mult=clamp($('batchMultiplier').value,1,20);publishDemo('soil_mixer','start_recipe',{recipe_id:r.id,recipe_name:r.name,weights_g:r.weights.map(v=>v*mult),total_g:r.weights.reduce((a,b)=>a+b,0)*mult});
    mixActive=true;mixProgress=0;setMix(0,'เริ่มจำลองการชั่งวัตถุดิบ');$('startMix').disabled=true;
    mixTimer=setInterval(()=>{mixProgress=Math.min(100,mixProgress+2);const phase=mixProgress<65?'ชั่งวัตถุดิบตามสูตร':mixProgress<88?'กำลังผสม':mixProgress<100?'กำลังปล่อยวัสดุ':'จำลองการผสมเสร็จ';setMix(mixProgress,phase);if(mixProgress>=100){clearInterval(mixTimer);mixTimer=null;mixActive=false;$('startMix').disabled=false;banner('จำลองการผสมเสร็จสิ้น')}},220);
  };
  $('stopMix').onclick=()=>{if(mixTimer)clearInterval(mixTimer);mixTimer=null;mixActive=false;$('startMix').disabled=false;setMix(mixProgress,'หยุดการจำลอง');publishDemo('soil_mixer','stop',{});banner('หยุดการจำลองแล้ว')};
  function renderFloors(){
    $('floorCards').innerHTML=state.floors.map(f=>`<article class="floor-card"><div class="name"><h3>${f.id===1?'❄️':f.id===2?'🌿':'☀️'} ชั้น ${f.id} · ${f.id===1?'Cool':f.id===2?'Mild':'Warm'} Zone</h3><span class="pill">DEMO / OFFLINE</span></div><div class="sensor-grid"><div class="sensor"><span>🌡 อุณหภูมิ</span><strong>${f.temp.toFixed(1)}<small> °C</small></strong></div><div class="sensor"><span>💧 ความชื้นอากาศ</span><strong>${num(f.humidity)}<small> %RH</small></strong></div><div class="sensor"><span>🌱 ความชื้นดิน</span><strong>${num(f.soil)}<small> %</small></strong></div><div class="sensor"><span>🎯 เป้าหมาย</span><strong>${num(f.target)}<small> °C</small></strong></div></div><div class="floor-controls"><div class="control-row"><label>อุณหภูมิเป้าหมาย (°C)</label><input type="number" min="10" max="40" step="0.5" value="${f.target}" data-floor-target="${f.id}"></div><div class="control-row"><label>ความชื้นอากาศเป้าหมาย (%RH)</label><input type="number" min="30" max="90" step="1" value="${f.targetRH}" data-floor-rh="${f.id}"></div><div class="control-row"><label>ชั่วโมงเปิดไฟ LED / วัน</label><input type="number" min="0" max="24" step="1" value="${f.lightHours}" data-floor-light="${f.id}"></div><div class="control-row"><label>ควบคุมอุณหภูมิอัตโนมัติ*</label><label class="switch"><input type="checkbox" data-floor-auto="${f.id}" ${f.auto?'checked':''}><span></span></label></div><div class="control-row"><label>พัดลม (คำสั่งจำลอง)</label><label class="switch"><input type="checkbox" data-floor-fan="${f.id}" ${f.fan?'checked':''}><span></span></label></div><div class="floor-actions"><button class="primary" data-floor-water="${f.id}" ${f.water?'disabled':''}>${f.water?'กำลังรดน้ำ...':'💧 รดน้ำทันที'}</button><button class="secondary" data-floor-stop="${f.id}">■ หยุดปั๊ม</button></div></div><p class="help">*เป็นค่าเป้าหมายสำหรับพัฒนา firmware ไม่ใช่วงควบคุมอุณหภูมิจริง</p></article>`).join('');
    $('overviewFloors').innerHTML=state.floors.map(f=>`<div class="mini-floor"><span>🌿 โรงเรือนชั้น ${f.id}</span><span class="temp">${f.temp.toFixed(1)} °C &nbsp;·&nbsp; ${num(f.humidity)} %RH</span></div>`).join('');
  }
  $('floorCards').addEventListener('change',e=>{
    const el=e.target;let id=el.dataset.floorTarget||el.dataset.floorFan||el.dataset.floorAuto||el.dataset.floorRh||el.dataset.floorLight;if(!id)return;
    const f=state.floors.find(x=>x.id===Number(id));if(!f)return;
    if(el.dataset.floorTarget){f.target=clamp(el.value,10,40);publishDemo(`greenhouse/${f.id}`,'set_target_temperature',{target_c:f.target});}
    if(el.dataset.floorRh){f.targetRH=clamp(el.value,30,90);publishDemo(`greenhouse/${f.id}`,'set_target_rh',{target_rh_pct:f.targetRH});}
    if(el.dataset.floorLight){f.lightHours=clamp(el.value,0,24);publishDemo(`greenhouse/${f.id}`,'set_light_hours',{hours_per_day:f.lightHours});}
    if(el.dataset.floorFan){f.fan=el.checked;publishDemo(`greenhouse/${f.id}`,'set_fan',{on:f.fan});}
    if(el.dataset.floorAuto){f.auto=el.checked;publishDemo(`greenhouse/${f.id}`,'set_auto_temperature',{enabled:f.auto});}
    save();renderFloors();
  });
  const timers=new Map();
  function waterFloor(id){let f=state.floors.find(x=>x.id===Number(id));if(!f||f.water)return;
    f.water=true;f.soil=clamp(f.soil+5,0,100);publishDemo(`greenhouse/${id}`,'water_now',{duration_seconds:8});save();renderFloors();banner(`จำลองรดน้ำโรงเรือนชั้น ${id} (8 วินาที)`);
    clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>{f.water=false;save();renderFloors()},8000));
  }
  function stopWater(id){let f=state.floors.find(x=>x.id===Number(id));if(!f)return;clearTimeout(timers.get(Number(id)));f.water=false;publishDemo(`greenhouse/${id}`,'stop_water',{});save();renderFloors();banner(`จำลองหยุดปั๊มชั้น ${id}`)}
  $('floorCards').onclick=e=>{const water=e.target.closest('[data-floor-water]'),stop=e.target.closest('[data-floor-stop]');if(water)waterFloor(water.dataset.floorWater);if(stop)stopWater(stop.dataset.floorStop)};
  function renderScheduleTargets(){const type=$('scheduleAction').value;const opts=type==='water'?state.floors.map(f=>`<option value="${f.id}">โรงเรือนชั้น ${f.id}</option>`).join(''):state.recipes.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');$('scheduleTarget').innerHTML=opts}
  $('scheduleAction').onchange=renderScheduleTargets;
  $('scheduleRepeat').onchange=()=>{$('scheduleDateWrap').hidden=$('scheduleRepeat').value!=='once'};
  function renderSchedules(){
    if($('scheduleCount'))$('scheduleCount').textContent=state.schedules.length;
    $('scheduleList').innerHTML=state.schedules.length?state.schedules.map(s=>`<div class="schedule-item"><div><b>${escapeHtml(s.label)}</b><small>⏱ ${escapeHtml(s.time)} น. · ${s.repeat==='daily'?'ทุกวัน':escapeHtml(s.date||'ครั้งเดียว')}</small><small>โหมดจำลองในเบราว์เซอร์เท่านั้น</small></div><button aria-label="ลบตาราง" data-remove-schedule="${escapeHtml(s.id)}">ลบ</button></div>`).join(''):'<div class="empty">ยังไม่มีรายการตั้งเวลา</div>';
  }
  $('addSchedule').onclick=()=>{
    const action=$('scheduleAction').value,target=$('scheduleTarget').value,time=$('scheduleTime').value,repeat=$('scheduleRepeat').value,date=$('scheduleDate').value;
    if(!time || (repeat==='once'&&!date)){banner('กรุณาระบุเวลาและวันที่');return}
    const recipeName=state.recipes.find(x=>x.id===target)?.name||'สูตรที่ลบไปแล้ว';
    const label=action==='water'?`รดน้ำชั้น ${target}`:`ผสมดิน — ${recipeName}`;
    state.schedules.push({id:'s'+Date.now(),action,target,time,repeat,date:repeat==='once'?date:null,label});save();renderSchedules();banner('บันทึกตารางเวลาตัวอย่างแล้ว')
  };
  $('scheduleList').onclick=e=>{const b=e.target.closest('[data-remove-schedule]');if(!b)return;state.schedules=state.schedules.filter(s=>s.id!==b.dataset.removeSchedule);save();renderSchedules()};
  function bangkokTime(){const p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value);return {ymd:`${p.year}-${p.month}-${p.day}`,hhmm:`${p.hour}:${p.minute}`}}
  const triggered=new Set();
  function checkSchedule(){const n=bangkokTime();const key=n.ymd+'T'+n.hhmm;for(const s of state.schedules){if(s.time!==n.hhmm||(s.repeat==='once'&&s.date!==n.ymd)||triggered.has(s.id+key))continue;triggered.add(s.id+key);if(s.action==='water')waterFloor(Number(s.target));else{state.selectedRecipe=s.target;renderRecipes();if(!mixActive)$('startMix').click();}addLog(`ตารางเวลาจำลองทำงาน: ${s.label}`);if(s.repeat==='once')state.schedules=state.schedules.filter(x=>x.id!==s.id);save();renderSchedules()}}
  $('copyPayload').onclick=async()=>{if(!lastPayload){banner('กรุณาลองกดคำสั่งก่อน');return}try{await navigator.clipboard.writeText(JSON.stringify(lastPayload,null,2));banner('คัดลอก JSON แล้ว')}catch{banner('คัดลอกไม่ได้: เลือกข้อความจากกรอบด้านบนแทน')}};
  function tick(){const n=bangkokTime();$('clock').textContent=n.hhmm+' น.';checkSchedule()}

  // ---------------------------------------------------------------------------
  // MODULE 03 — capsule UI simulation. No mechanical motion is controlled.
  // ---------------------------------------------------------------------------
  function renderCapsuleSelect(){
    const options=state.recipes.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
    const old=$('capsuleRecipe').value;$('capsuleRecipe').innerHTML=options;
    if(state.recipes.some(r=>r.id===old))$('capsuleRecipe').value=old;
  }
  let capsuleTimer=null,capsulePercentage=0;
  function renderCapsuleHistory(){
    $('capsuleHistory').innerHTML=state.capsuleBatches.length?state.capsuleBatches.slice(0,5).map(b=>`<div class="batch-row"><div><b>${escapeHtml(b.id)}</b><small>${escapeHtml(b.recipeName)} · ${escapeHtml(b.shape)} · ${b.diameter} มม. · ${b.quantity} ชิ้น</small></div><span class="pill">SIMULATED</span></div>`).join(''):'<div class="empty">ยังไม่มี Batch แคปซูล</div>';
  }
  function capsuleProgress(p,msg){capsulePercentage=p;$('capsuleBar').style.width=p+'%';$('capsuleProgressText').textContent=`${p}% — ${msg}`;$('capsuleStatusPill').textContent=p===100?'COMPLETE':capsuleTimer?'RUNNING':'IDLE';}
  $('capsuleSize').onchange=()=>{$('capsuleShapeLabel').textContent='Ø '+$('capsuleSize').value+' mm'};
  $('startCapsule').onclick=()=>{
    if(capsuleTimer){banner('กำลังจำลองการผลิตแคปซูลอยู่');return}
    const r=state.recipes.find(x=>x.id===$('capsuleRecipe').value);if(!r){banner('กรุณาเลือกสูตรวัสดุปลูก');return}
    const quantity=clamp($('capsuleQuantity').value,1,100),seedCount=clamp($('capsuleSeed').value,1,4),diameter=Number($('capsuleSize').value),shape=$('capsuleShape').value;
    const batch={id:'CP-'+Date.now().toString().slice(-7),recipeId:r.id,recipeName:r.name,shape:shape==='sphere'?'ทรงกลม':'ทรงเตี้ย',diameter,quantity,seedCount,note:$('capsuleNote').value.trim(),demo:true};
    publishDemo('capsule_press','start_batch',{recipe_id:r.id,shape,diameter_mm:diameter,quantity,seeds_per_capsule:seedCount,note:batch.note});
    $('startCapsule').disabled=true;capsuleProgress(0,'เตรียมแม่พิมพ์');let p=0;
    capsuleTimer=setInterval(()=>{p=Math.min(100,p+4);capsuleProgress(p,p<30?'เตรียมวัสดุ':p<75?'กดแม่พิมพ์จำลอง':p<100?'ปล่อยแคปซูล':'เสร็จสิ้น');if(p>=100){clearInterval(capsuleTimer);capsuleTimer=null;$('startCapsule').disabled=false;state.capsuleBatches.unshift(batch);state.capsuleBatches=state.capsuleBatches.slice(0,30);save();renderCapsuleHistory();banner('สร้าง Batch จำลองแล้ว — ไม่ได้ผลิตจริง')}},110);
  };
  $('stopCapsule').onclick=()=>{if(capsuleTimer)clearInterval(capsuleTimer);capsuleTimer=null;$('startCapsule').disabled=false;capsuleProgress(capsulePercentage,'หยุดจำลอง');publishDemo('capsule_press','stop',{});banner('หยุดการจำลองแล้ว')};

  // ---------------------------------------------------------------------------
  // FLL experiment notebook; manually entered data or CLEARLY LABELLED examples.
  // ---------------------------------------------------------------------------
  function renderExperimentRecipeSelect(){
    const old=$('experimentRecipe').value;$('experimentRecipe').innerHTML=state.recipes.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
    if(state.recipes.some(r=>r.id===old))$('experimentRecipe').value=old;
  }
  function renderExperiments(){
    $('experimentCount').textContent=state.experiments.length;
    $('recordCount').textContent=state.experiments.length;
    $('speciesCount').textContent=new Set(state.experiments.map(e=>e.plant.trim().toLowerCase())).size;
    const records=state.experiments.slice().reverse();
    $('experimentsTable').innerHTML=records.length?records.map(e=>{
      const pct=e.seeds>0?Math.round(e.germinated/e.seeds*100):0;
      return `<tr><td>${escapeHtml(e.date)}<small>${escapeHtml(e.id)}${e.isSample?' · SAMPLE':''}</small></td><td>${escapeHtml(e.plant)}</td><td>${escapeHtml(e.recipeName)}</td><td>${escapeHtml(e.capsule)}</td><td>ชั้น ${e.floor}</td><td><strong>${pct}%</strong> (${e.germinated}/${e.seeds})</td><td>${e.height} cm</td><td><button class="mini-delete" data-remove-exp="${escapeHtml(e.id)}" aria-label="ลบผลการทดลอง">ลบ</button></td></tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">ยังไม่มีข้อมูลทดลอง — กรอกบันทึกใหม่ หรือเติมตัวอย่างเพื่อดูหน้าตากราฟ</td></tr>';
    $('experimentBars').innerHTML=records.length?records.slice(-6).map(e=>{const pct=Math.round(e.germinated/e.seeds*100);return `<div class="bar-record"><div class="bar-text"><b>${escapeHtml(e.plant)} · ${escapeHtml(e.recipeName)}</b><span>${pct}%${e.isSample?' · ตัวอย่าง':''}</span></div><div class="bar flat"><i style="width:${pct}%"></i></div></div>`}).join(''):'<div class="empty">กราฟจะปรากฏเมื่อมีผลการทดลอง</div>';
    renderInsights();
  }
  $('experimentForm').addEventListener('submit',e=>{
    e.preventDefault();const seeds=Number($('experimentSeedCount').value),germinated=Number($('experimentGerminated').value),height=Number($('experimentHeight').value),water=Number($('experimentWater').value);
    if(!Number.isFinite(seeds)||seeds<=0||!Number.isInteger(seeds)||!Number.isInteger(germinated)||germinated<0||germinated>seeds||height<0||water<0){banner('ตรวจสอบข้อมูล: จำนวนงอกต้องไม่เกินจำนวนเมล็ดทั้งหมด');return}
    const r=state.recipes.find(x=>x.id===$('experimentRecipe').value);if(!r){banner('ยังไม่มีสูตรวัสดุปลูก');return}
    const n={id:'EX-'+Date.now().toString().slice(-8),date:$('experimentDate').value,plant:$('experimentPlant').value.trim(),question:$('experimentQuestion').value.trim(),recipeId:r.id,recipeName:r.name,capsule:$('experimentCapsule').selectedOptions[0].textContent,floor:Number($('experimentFloor').value),seeds,germinated,height,water,isSample:false};
    if(!n.plant||!n.date){banner('กรุณาระบุชื่อพืชและวันที่');return}
    state.experiments.push(n);save();renderExperiments();banner('บันทึกผลทดลองในเบราว์เซอร์นี้แล้ว');$('experimentForm').reset();$('experimentDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  });
  $('experimentsTable').onclick=e=>{const b=e.target.closest('[data-remove-exp]');if(!b)return;state.experiments=state.experiments.filter(x=>x.id!==b.dataset.removeExp);save();renderExperiments()};
  $('loadSampleExperiments').onclick=()=>{
    if(state.experiments.some(e=>e.isSample)){banner('มีข้อมูลตัวอย่างอยู่แล้ว');return}
    const n=Date.now();
    const samples=[{s:20,g:10,r:0,cap:'เมล็ดธรรมดา (กลุ่มควบคุม)',h:2.8},{s:20,g:14,r:1,cap:'แคปซูลทรงกลม',h:3.5},{s:20,g:13,r:2,cap:'แคปซูลทรงเตี้ย',h:3.1}];
    samples.forEach((x,i)=>state.experiments.push({id:'SAMPLE-'+(n+i),date:'2026-11-18',plant:'ผักสลัด [ตัวอย่าง]',question:'สาธิตการแสดงผล ไม่ใช่การทดลองจริง',recipeId:state.recipes[x.r]?.id||state.recipes[0].id,recipeName:state.recipes[x.r]?.name||state.recipes[0].name,capsule:x.cap,floor:1,seeds:x.s,germinated:x.g,height:x.h,water:130,isSample:true}));
    save();renderExperiments();banner('เพิ่มข้อมูลตัวอย่าง 3 รายการแล้ว — ไม่ใช่ผลทดลองจริง');
  };
  function renderInsights(){
    const real=state.experiments.filter(e=>!e.isSample);
    if(real.length<2){$('insightContent').innerHTML='<div class="insight-empty"><strong>ยังไม่สามารถเปรียบเทียบผลการทดลองจริง</strong><p>ต้องมีข้อมูลอย่างน้อย 2 ชุดที่เป็นพืชชนิดเดียวกัน และมีเงื่อนไขควบคุมชัดเจน ข้อมูลตัวอย่างไม่ถูกนำมาใช้เป็นข้อค้นพบจริง</p></div>';return}
    const groups={};real.forEach(e=>{const k=e.plant.trim().toLowerCase();(groups[k]||(groups[k]=[])).push(e)});
    const entry=Object.values(groups).find(a=>a.length>=2);
    if(!entry){$('insightContent').innerHTML='<div class="insight-empty">บันทึกหลายชุดแล้ว แต่ยังไม่พบพืชชนิดเดียวกันอย่างน้อย 2 ชุดสำหรับเปรียบเทียบ</div>';return}
    const sorted=[...entry].sort((a,b)=>b.germinated/b.seeds-a.germinated/a.seeds);const best=sorted[0];const pct=Math.round(best.germinated/best.seeds*100);
    $('insightContent').innerHTML=`<div class="insight-highlight"><small>ข้อสังเกตจากข้อมูลที่กรอก</small><strong>${escapeHtml(best.plant)}</strong><span>ชุด ${escapeHtml(best.id)} มีอัตราการงอกสูงสุดในกลุ่มข้อมูลที่บันทึก: <b>${pct}%</b> (${best.germinated}/${best.seeds})</span></div><p>นี่เป็นเพียงการจัดอันดับตามค่าอัตราการงอกที่บันทึก ยังพิสูจน์ไม่ได้ว่าสาเหตุมาจากสูตรดินหรือภูมิอากาศ เพราะต้องพิจารณาจำนวนซ้ำ ชุดควบคุม และเงื่อนไขอื่น</p>`;
  }
  $('experimentDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  renderCapsuleSelect();renderCapsuleHistory();renderExperimentRecipeSelect();renderExperiments();

  renderRecipes();renderFloors();renderSchedules();renderLog();setMix(0,'พร้อมรับคำสั่ง');tick();setInterval(tick,10000);
  // Simulate telemetry variation only. No real sensor data is ever received.
  setInterval(()=>{state.floors.forEach(f=>{f.temp=clamp(Math.round((f.temp+(Math.random()-.5)*.17)*10)/10,15,39);f.humidity=clamp(f.humidity+Math.round((Math.random()-.5)*2),20,99)});renderFloors()},12000);
})();
