function setAddMode(mode){
  addMode=mode;
  const photoMode=(mode==="camera"||mode==="photo");
  const fileMode=mode==="file";
  $("cameraChoice").classList.toggle("active",mode==="camera");
  $("photoChoice").classList.toggle("active",mode==="photo");
  $("fileChoice").classList.toggle("active",fileMode);
  $("addChoice").style.display=(photoMode||fileMode)?"none":"grid";
  $("manualForm").style.display=mode==="manual"?"block":"none";
  $("photoForm").style.display=photoMode?"block":"none";
  $("fileForm").style.display=fileMode?"block":"none";
}

function openAdd(){
  editId=null;
  modalTitle.textContent="Добавить прибор";
  setAddMode("manual");
  $("addChoice").style.display="grid";
  tagInput.value="";
  manualTaskInput.value="";
  statusInput.value="todo";
  deleteBtn.style.display="none";
  $("importList").innerHTML="";
  $("importActions").style.display="none";
  $("photoImportLegend").classList.remove("ready");
  $("ocrStatus").textContent="";
  $("fileImportList").innerHTML="";
  $("fileImportActions").style.display="none";
  $("fileImportLegend").classList.remove("ready");
  $("fileImportStatus").textContent="";
  $("fileProgressWrap").style.display="none";
  setFileProgress(0);
  overlay.classList.add("show");
  setTimeout(()=>tagInput.focus(),50);
}

function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function loadSheetJs(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(sheetJsPromise)return sheetJsPromise;
  sheetJsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async=true;
    script.onload=()=>window.XLSX ? resolve(window.XLSX) : reject(new Error("Не удалось запустить модуль Excel"));
    script.onerror=()=>reject(new Error("Не удалось загрузить модуль Excel. Проверь интернет и повтори."));
    document.head.appendChild(script);
  });
  return sheetJsPromise;
}

function renderFileCandidates(){
  const box=$("fileImportList"),actions=$("fileImportActions");
  box.innerHTML="";
  $("fileImportLegend").classList.remove("ready");
  if(!fileCandidates.length){
    box.innerHTML='<div class="mini">Подходящих КИП-тегов не найдено. Проверь формат вида 2131-PZT-414A.</div>';
    actions.style.display="none";return;
  }
  const existing=new Set(data.map(item=>tagKey(item.tag)));
  $("fileImportLegend").classList.add("ready");
  fileCandidates.forEach(candidate=>{
    const tag=String(candidate.tag||"").toUpperCase(),already=existing.has(tagKey(tag));
    const row=document.createElement("div");row.className="importItem";row.dataset.candidateTag=tag;
    const line=document.createElement("div");line.className="importRow";
    const pick=document.createElement("input");pick.type="checkbox";pick.className="importPick";pick.checked=!already;pick.disabled=already;pick.title="Добавить";pick.setAttribute("aria-label",`Добавить ${tag}`);
    const inp=document.createElement("input");inp.type="text";inp.value=tag;inp.className="importTag";inp.setAttribute("aria-label",`Тег ${tag}`);
    const taskToggle=document.createElement("button");taskToggle.type="button";taskToggle.className="importTaskInline"+(candidate.task?" hasTask":"");taskToggle.title=candidate.task?"Задание: есть запись":"Задание";taskToggle.setAttribute("aria-label",`Задание для ${tag}`);taskToggle.setAttribute("aria-expanded",candidate.task?"true":"false");
    const done=document.createElement("input");done.type="checkbox";done.className="importDone";done.checked=!!candidate.done;done.title="Выполнено";done.setAttribute("aria-label",`Выполнено: ${tag}`);
    const taskWrap=document.createElement("div");taskWrap.className="importTaskWrap"+(candidate.task?" open":"");
    const task=document.createElement("textarea");task.className="importTask";task.rows=1;task.placeholder="Задание / запись";task.value=candidate.task||"";taskWrap.appendChild(task);
    taskToggle.addEventListener("click",()=>{const open=taskWrap.classList.toggle("open");taskToggle.setAttribute("aria-expanded",String(open));if(open)setTimeout(()=>task.focus(),20);});
    task.addEventListener("input",()=>{const has=!!task.value.trim();taskToggle.classList.toggle("hasTask",has);taskToggle.title=has?"Задание: есть запись":"Задание";});
    line.append(pick,inp,taskToggle,done);row.append(line,taskWrap);box.appendChild(row);
  });
  actions.style.display="flex";
}

async function processTextImport(text,label="Текст",startProgress=35){
  const status=$("fileImportStatus");
  $("fileProgressWrap").style.display="block";setFileProgress(startProgress);await nextFrame();
  const records=extractTagRecordsFromText(text);
  setFileProgress(Math.max(startProgress+8,78));await nextFrame();
  fileCandidates=records;
  status.textContent=`${label}: найдено тегов ${records.length}. Проверь задания и отметки перед добавлением.`;
  renderFileCandidates();
  setFileProgress(100);setTimeout(()=>{$("fileProgressWrap").style.display="none"},450);
}

async function pasteTextImport(){
  try{
    if(!navigator.clipboard?.readText)throw new Error("clipboard");
    const text=await navigator.clipboard.readText();
    if(!text.trim())throw new Error("empty");
    await processTextImport(text,"Буфер обмена");
  }catch(e){
    const text=prompt("Вставь сюда скопированный текст со списком тегов и заданий:","");
    if(text&&text.trim())await processTextImport(text,"Вставленный текст");
    else if(e.message==="clipboard")showToast("Не удалось прочитать буфер. Вставь текст вручную в появившееся поле.");
  }
}

async function runFileImport(file){
  const status=$("fileImportStatus");
  $("fileImportList").innerHTML="";$("fileImportActions").style.display="none";fileCandidates=[];
  $("fileProgressWrap").style.display="block";setFileProgress(5);
  try{
    if(file.size>10*1024*1024)throw new Error("Файл больше 10 МБ. Для бюджетного устройства лучше экспортировать нужный лист или сохранить его как CSV.");
    await nextFrame();
    const name=String(file.name||"").toLowerCase();let text="";
    if(/\.(xlsx|xls)$/.test(name)){
      status.textContent="Открываю Excel локально на устройстве…";setFileProgress(20);await nextFrame();
      const XLSX=await loadSheetJs();setFileProgress(38);await nextFrame();
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellText:true,cellDates:false});
      setFileProgress(58);await nextFrame();
      // Сохраняем строки как TSV, чтобы извлечь не только теги, но и соседние поля
      // «Выполнено» / «Задание».
      text=workbook.SheetNames.map(sheetName=>XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName],{FS:"\t"})).join("\n");
      setFileProgress(72);await nextFrame();
    }else if(/\.(csv|tsv|txt|json)$/.test(name)||/^text\//.test(file.type||"")||file.type==="application/json"){
      status.textContent="Читаю файл…";setFileProgress(28);await nextFrame();
      text=await file.text();setFileProgress(68);await nextFrame();
    }else throw new Error("Поддерживаются XLSX, XLS, CSV, TSV, TXT и JSON. Для PDF или Word сначала сохрани таблицу как CSV или Excel.");
    await processTextImport(text,file.name||"Файл",Math.max(72,Number($('fileBar').style.width.replace("%",""))||72));
    setFileProgress(100);status.textContent=`${file.name||"Файл"}: найдено тегов ${fileCandidates.length}. Проверь задания и отметки перед добавлением.`;
    setTimeout(()=>{$("fileProgressWrap").style.display="none"},500);
  }catch(error){
    console.error(error);setFileProgress(0);status.textContent=`Не удалось импортировать: ${error.message||error}`;
  }
}

function importFileCandidates(){
  const rows=[...$("fileImportList").querySelectorAll(".importItem")];
  const existing=new Set(data.map(item=>tagKey(item.tag)));const additions=[],duplicates=[],invalid=[];
  rows.forEach((row,index)=>{
    const checked=row.querySelector('.importPick');if(!checked?.checked)return;
    const tagInput=row.querySelector('.importTag'),doneInput=row.querySelector('.importDone'),taskInput=row.querySelector('.importTask');
    const tag=tagInput.value.trim().toUpperCase(),unit=(tag.match(/^(\d{4})-/)||[])[1],key=tagKey(tag);
    if(!unit||!/^[0-9]{4}-[A-Z]{2,8}-[0-9]{3}[A-Z]?$/.test(tag)){invalid.push(index+1);return;}
    if(existing.has(key)){duplicates.push(tag);return;}
    existing.add(key);additions.push({unit,tag,done:!!doneInput?.checked,task:String(taskInput?.value||"").trim()});
  });
  if(invalid.length){showToast(`Исправь тег(и) №${invalid.join(", ")} перед добавлением`);return;}
  if(duplicates.length){const unique=[...new Set(duplicates)];showToast(`Дубликаты не добавлены: ${unique.join(", ")}. Измени тег или сними отметку.`);return;}
  if(!additions.length){showToast("Новых тегов для добавления нет");return;}
  const max=data.reduce((m,x)=>Math.max(m,Number(x.id)||0),0),before=data.length;
  data=data.concat(additions.map((x,i)=>({id:max+i+1,...x})));
  try{save();if(data.length!==before+additions.length)throw new Error("Проверка количества после сохранения не прошла");}
  catch(error){console.error(error);data=data.slice(0,before);save();showToast("Не удалось сохранить добавленные теги. Повтори ещё раз.");return;}
  closeModal();render();showToast(`Добавлено из файла/текста: ${additions.length}`);
}
