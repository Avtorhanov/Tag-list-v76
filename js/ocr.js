async function fileToJpeg(file,maxSide=1800,quality=.76,maxBytes=900*1024){
  return new Promise((resolve,reject)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=async()=>{
      try{
        let side=maxSide, q=quality, blob=null;
        // Android camera photos can be very large. OCR.space free API has a 1 MB file limit,
        // so compress adaptively before sending instead of uploading the original.
        for(let attempt=0;attempt<6;attempt++){
          const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight));
          const c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(img.naturalWidth*scale));
          c.height=Math.max(1,Math.round(img.naturalHeight*scale));
          const ctx=c.getContext('2d',{alpha:false});
          ctx.drawImage(img,0,0,c.width,c.height);
          blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
          if(blob && blob.size<=maxBytes) break;
          side=Math.round(side*.82); q=Math.max(.58,q-.05);
        }
        URL.revokeObjectURL(url);
        if(!blob) return reject(new Error('Не удалось подготовить изображение'));
        if(blob.size>maxBytes && maxBytes<=900*1024) return reject(new Error('Фото слишком большое для OCR. Попробуй снять ближе или использовать «Загрузка фото».'));
        resolve(blob);
      }catch(e){URL.revokeObjectURL(url);reject(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Не удалось открыть изображение'))};
    img.src=url;
  });
}

function fetchWithTimeout(url,options={},timeoutMs=35000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...options,signal:controller.signal})
    .finally(()=>clearTimeout(timer))
    .catch(e=>{
      if(e && e.name==='AbortError') throw new Error('Сервис распознавания не ответил вовремя. Попробуй ещё раз или используй резервный OCR.');
      throw e;
    });
}

async function runOCR(file){
  const runToken=++ocrRunToken;
  $("ocrProgressWrap").style.display="block";
  setProgress(5);
  try{
    $("ocrStatus").textContent="Подготавливаю фото…";
    ocrCandidateMeta=new Map();
    const image=await fileToJpeg(file,1800,.76,900*1024);
    if(runToken!==ocrRunToken)return;
    const key=safeGetStorage('kipOcrSpaceKey','helloworld')||'helloworld';
    const localPage=location.protocol==='file:' || location.origin==='null' || /android\.fileexplorer\.myprovider/i.test(location.origin);
    if(localPage){
      $("ocrStatus").textContent="Для распознавания открой приложение через HTTPS (например GitHub Pages).";
      setProgress(0);
      return;
    }
    let lastError=null;
    for(const engine of ['3','2']){
      try{
        $("ocrStatus").textContent=engine==='3' ? "OCR.space Engine 3…" : "Engine 3 не сработал — пробую Engine 2…";
        setProgress(engine==='2'?25:55);
        const fd=new FormData();
        fd.append('file',image,'kip-photo.jpg');
        fd.append('apikey',key);
        fd.append('language','auto');
        fd.append('OCREngine',engine);
        fd.append('isTable','true');
        fd.append('detectOrientation','true');
        fd.append('scale','true');
        fd.append('isOverlayRequired','false');
        const r=await fetchWithTimeout('https://api.ocr.space/parse/image',{method:'POST',body:fd},engine==='2'?20000:30000);
        if(!r.ok)throw new Error(`OCR.space HTTP ${r.status}`);
        setProgress(engine==='3'?82:70);
        const out=await r.json();
        if(out.IsErroredOnProcessing)throw new Error(out.ErrorMessage||out.ErrorDetails||'OCR.space error');
        const text=(out.ParsedResults||[]).map(x=>x.ParsedText||'').join('\n');
        const records=extractTagRecordsFromText(text);
        ocrCandidates=records.length?records.map(x=>x.tag):extractTagsSmart(text);
        ocrCandidateMeta=new Map(records.map(x=>[tagKey(x.tag),{completed:!!x.done,task:x.task||"",score:0.65}]));
        if(runToken!==ocrRunToken)return;
        setProgress(100);
        $("ocrStatus").textContent=`OCR.space Engine ${engine}: найдено кандидатов ${ocrCandidates.length}. Проверь отметки и задания перед добавлением.`;
        renderImportCandidates();
        return;
      }catch(e){
        lastError=e;
        if(engine==='2')continue;
      }
    }
    throw lastError||new Error('OCR.space не ответил');
  }catch(e){
    if(runToken!==ocrRunToken)return;
    console.error(e);
    setProgress(0);
    $("ocrStatus").textContent=`Ошибка распознавания: ${e.message||e}. Проверь интернет и доступ к OCR.space.`;
  }
}

function renderImportCandidates(){
  const box=$('importList'),actions=$('importActions');
  box.innerHTML='';
  $("photoImportLegend").classList.remove("ready");
  if(!ocrCandidates.length){
    box.innerHTML='<div class="mini">Подходящих КИП-тегов не найдено. Попробуй сфотографировать ближе, ровнее или использовать «Загрузка фото» с оригиналом.</div>';
    actions.style.display='none'; return;
  }
  const existing=new Set(data.map(x=>tagKey(x.tag)));
  $("photoImportLegend").classList.add("ready");
  ocrCandidates.forEach(candidate=>{
    const tag=String(candidate||'').toUpperCase(),already=existing.has(tagKey(tag));
    const meta=ocrCandidateMeta.get(tagKey(tag))||{completed:false,task:''};
    const row=document.createElement('div'); row.className='importItem'; row.dataset.candidateTag=tag;
    const line=document.createElement('div'); line.className='importRow';

    const pick=document.createElement('input');
    pick.type='checkbox'; pick.className='importPick'; pick.checked=!already; pick.disabled=already;
    pick.setAttribute('aria-label',`Добавить ${tag}`); pick.title='Добавить';

    const inp=document.createElement('input');
    inp.type='text'; inp.value=tag; inp.className='importTag'; inp.setAttribute('aria-label',`Тег ${tag}`);

    const done=document.createElement('input');
    done.type='checkbox'; done.className='importDone'; done.checked=!!meta.completed;
    if(meta.evidence) done.title=`Выполнено: ${meta.evidence}`;
    done.setAttribute('aria-label',`Выполнено: ${tag}`); done.title='Выполнено';

    const taskToggle=document.createElement('button');
    taskToggle.type='button'; taskToggle.className='importTaskInline'+(meta.task?' hasTask':'');
    taskToggle.textContent='▾'; taskToggle.title=meta.task?'Задание: есть запись':'Задание';
    taskToggle.setAttribute('aria-expanded',meta.task?'true':'false');
    taskToggle.setAttribute('aria-label',`Задание для ${tag}`);

    const taskWrap=document.createElement('div'); taskWrap.className='importTaskWrap'+(meta.task?' open':'');
    const task=document.createElement('textarea');
    task.className='importTask'; task.rows=1; task.placeholder='Запись / задание с фото'; task.value=meta.task||'';
    task.setAttribute('aria-label',`Задание для ${tag}`); taskWrap.appendChild(task);

    taskToggle.addEventListener('click',()=>{
      const open=taskWrap.classList.toggle('open');
      taskToggle.setAttribute('aria-expanded',String(open));
      taskToggle.classList.toggle('hasTask',!!task.value.trim());
      taskToggle.title=task.value.trim()?'Задание: есть запись':'Задание';
      if(open)setTimeout(()=>task.focus(),20);
    });
    task.addEventListener('input',()=>{
      const has=!!task.value.trim();
      taskToggle.classList.toggle('hasTask',has);
      taskToggle.title=has?'Задание: есть запись':'Задание';
    });
    line.append(pick,inp,taskToggle,done);
    row.append(line,taskWrap); box.appendChild(row);
  });
  actions.style.display='flex';
}

function importCandidates(){
  const rows=[...$("importList").querySelectorAll(".importItem")];
  const selected=[];const invalid=[];
  rows.forEach((row,index)=>{
    const cb=row.querySelector('.importPick');if(!cb?.checked)return;
    const inp=row.querySelector('.importTag');const done=row.querySelector('.importDone');const task=row.querySelector('.importTask');
    const tag=inp.value.trim().toUpperCase();const m=tag.match(/^(\d{4})-/);
    if(!m||!/^[0-9]{4}-[A-Z]{2,8}-[0-9]{3}[A-Z]?$/.test(tag)){invalid.push(index+1);return;}
    selected.push({unit:m[1],tag,done:!!done?.checked,task:String(task?.value||"").trim()});
  });
  if(invalid.length){showToast(`Исправь тег(и) №${invalid.join(", ")} перед добавлением`);return;}
  if(!selected.length){showToast("Ничего не выбрано для добавления");return;}
  const existing=new Set(data.map(x=>tagKey(x.tag)));const batch=new Set();const duplicates=[];
  for(const item of selected){const key=tagKey(item.tag);if(existing.has(key)||batch.has(key))duplicates.push(item.tag);else batch.add(key);}
  if(duplicates.length){
    const unique=[...new Set(duplicates)];
    showToast(`Дубликаты не добавлены: ${unique.join(", ")}. Измени тег или сними отметку.`);
    rows.forEach(row=>{const inp=row.querySelector('.importTag');if(inp&&unique.includes(inp.value.trim().toUpperCase()))inp.style.borderColor="#d9534f";});
    return;
  }
  const max=data.reduce((m,x)=>Math.max(m,Number(x.id)||0),0);
  const additions=selected.map((x,i)=>({id:max+i+1,unit:x.unit,tag:x.tag,done:x.done,task:x.task||""}));
  const before=data.length;
  data=data.concat(additions);
  try{save();if(data.length!==before+additions.length)throw new Error("Проверка количества после сохранения не прошла");}
  catch(error){console.error(error);data=data.slice(0,before);save();showToast("Не удалось сохранить добавленные теги. Повтори ещё раз.");return;}
  closeModal();render();showToast(`Добавлено распознанных: ${additions.length}`);
}
