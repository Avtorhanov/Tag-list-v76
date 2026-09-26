function uniqueUnits(){
  return [...new Set(data.map(x => String(x.unit).trim()).filter(Boolean))];
}

function visibleData(){
  const q = query.trim().toLowerCase();
  return data.filter(x => {
    const f = filter === "all" || (filter === "task" && !!String(x.task||"").trim()) ||
              (filter === "done" && x.done) || (filter === "todo" && !x.done) ||
              String(x.unit) === filter;
    const s = !q || x.tag.toLowerCase().includes(q) || String(x.unit).toLowerCase().includes(q);
    return f && s;
  });
}

function renderTabs(){
  const counts = {
    all:data.length,
    task:data.filter(x=>!!String(x.task||"").trim()).length,
    todo:data.filter(x=>!x.done).length,
    done:data.filter(x=>x.done).length
  };
  const defs = [["all","Все",counts.all]];
  if(counts.task) defs.push(["task","Задания",counts.task]);
  defs.push(["done","Выполненные",counts.done],["todo","Невыполненные",counts.todo]);
  uniqueUnits().forEach(u => defs.push([u,u,data.filter(x=>String(x.unit)===u).length]));
  if(!defs.some(x=>x[0]===filter)) filter="all";
  const frag=document.createDocumentFragment();
  defs.forEach(([key,label,count])=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="tab"+(filter===key?" active":"");
    b.dataset.filter=key;
    b.textContent=`${label} (${count})`;
    frag.appendChild(b);
  });
  tabs.replaceChildren(frag);
  tabs.classList.remove("tab-pop");
  requestAnimationFrame(()=>tabs.classList.add("tab-pop"));
}

function renderList(){
  const rows=visibleData();
  const frag=document.createDocumentFragment();
  if(!rows.length){
    const e=document.createElement("div");
    e.className="empty";
    e.textContent="Ничего не найдено";
    frag.appendChild(e);
    list.replaceChildren(frag);
    return;
  }
  rows.forEach(item=>{
    const row=document.createElement("div");
    row.className="row"+(item.done?" done":"");
    row.dataset.id=item.id;

    const check=document.createElement("button");
    check.type="button";
    check.className="check"+(item.done?" on":"");
    check.setAttribute("aria-label",item.done?"Отметить как невыполненное":"Отметить как выполненное");

    const num=document.createElement("div");num.className="num";num.textContent=item.id;
    const info=document.createElement("div");info.className="info";
    const tag=document.createElement("div");tag.className="tag";tag.textContent=item.tag;

    const taskLine=document.createElement("div");taskLine.className="taskLine";
    const taskToggle=document.createElement("button");
    taskToggle.type="button";
    taskToggle.className="taskToggle"+(item.task?" hasTask":"");
    taskToggle.textContent="Задание";
    taskToggle.setAttribute("aria-expanded","false");
    const saveTask=document.createElement("button");
    saveTask.type="button";saveTask.className="taskSave";saveTask.textContent="Сохранить";
    const editorWrap=document.createElement("div");editorWrap.className="taskEditorWrap";
    const box=document.createElement("div");box.className="taskBox";
    const ta=document.createElement("textarea");
    ta.placeholder="Например: проверить питание 24 В, прозвонить линию, выполнить ПНР…";
    ta.value=item.task||"";
    box.appendChild(ta);editorWrap.appendChild(box);
    taskLine.append(taskToggle,saveTask);
    info.append(tag,taskLine,editorWrap);
    const actions=document.createElement("div");
    actions.className="rowActions";

    const cancelBtn=document.createElement("button");
    cancelBtn.type="button";cancelBtn.className="rowAction rowCancel";cancelBtn.textContent="×";
    cancelBtn.title="Отменить выбор";cancelBtn.setAttribute("aria-label","Отменить выбор тегов");

    const selectBtn=document.createElement("button");
    selectBtn.type="button";selectBtn.className="rowAction rowSelect";
    selectBtn.classList.toggle("selected",selectedTagIds.has(item.id));
    selectBtn.title=selectedTagIds.has(item.id)?"Снять выбор":"Выбрать тег";
    selectBtn.setAttribute("aria-label",selectedTagIds.has(item.id)?`Снять выбор ${item.tag}`:`Выбрать ${item.tag}`);

    const copyBtn=document.createElement("button");
    copyBtn.type="button";copyBtn.className="rowAction rowCopy";copyBtn.textContent="⧉";
    copyBtn.title="Скопировать тег";copyBtn.setAttribute("aria-label",`Скопировать ${item.tag}`);

    const editBtn=document.createElement("button");
    editBtn.type="button";editBtn.className="rowAction rowEdit";editBtn.textContent="✎";
    editBtn.title="Изменить тег";editBtn.setAttribute("aria-label",`Изменить ${item.tag}`);

    actions.append(cancelBtn,selectBtn,copyBtn,editBtn);
    row.classList.toggle("selection-mode",selectionMode);
    row.append(check,num,info,actions);
    frag.appendChild(row);
  });
  list.replaceChildren(frag);
}

function renderSummary(){
  const total=data.length;
  const done=data.filter(x=>x.done).length;
  const remaining=Math.max(0,total-done);
  const percent=total ? Math.round((done/total)*100) : 0;
  const scope=filter==="all" ? "Весь список" : filter==="todo" ? "Только невыполненные" : filter==="done" ? "Только выполненные" : `Unit ${filter}`;
  $("summaryCount").textContent=`${done} из ${total} выполнено`;
  $("summaryPercent").textContent=`${percent}%`;
  $("summaryRemaining").textContent=`Осталось: ${remaining}`;
  $("summaryFilter").textContent=query.trim() ? `${scope} · поиск` : scope;
  $("progressFill").style.width=`${percent}%`;
  $("progressTrack").setAttribute("aria-valuenow",String(percent));
}

function render(){
  renderPages();renderLastSaved();renderTabs();renderSummary();updateSelectionFooter();renderList();
}

function rowItemFromTarget(target){
  const row=target.closest(".row");
  if(!row)return null;
  const id=Number(row.dataset.id);
  const item=data.find(x=>x.id===id);
  return item?{row,item}:null;
}

function updateRenderedRowState(row,item){
  row.classList.toggle("done",!!item.done);
  const check=row.querySelector(".check");
  if(check){
    check.classList.toggle("on",!!item.done);
    check.setAttribute("aria-label",item.done?"Отметить как невыполненное":"Отметить как выполненное");
  }
}

function setTaskEditor(row,item,open,focus=false){
  const editor=row.querySelector(".taskEditorWrap"),toggle=row.querySelector(".taskToggle"),saveBtn=row.querySelector(".taskSave"),ta=row.querySelector(".taskBox textarea");
  if(!editor||!toggle||!saveBtn)return;
  editor.classList.toggle("open",open);
  toggle.classList.toggle("open",open);
  saveBtn.classList.toggle("show",open);
  toggle.setAttribute("aria-expanded",String(open));
  if(open&&focus&&ta)requestAnimationFrame(()=>ta.focus());
}

function setSelectionMode(enabled,initialId=null){
  selectionMode=!!enabled;
  if(!selectionMode) selectedTagIds.clear();
  else if(initialId!==null) selectedTagIds.add(initialId);
  document.body.classList.toggle("selection-mode-active",selectionMode);
  updateSelectionFooter();
  renderList();
}

function toggleTagSelection(id){
  if(selectedTagIds.has(id)) selectedTagIds.delete(id);
  else selectedTagIds.add(id);
  if(!selectedTagIds.size){
    selectionMode=false;
    document.body.classList.remove("selection-mode-active");
  }
  updateSelectionFooter();
  renderList();
}

function updateSelectionFooter(){
  const btn=$("deleteAll"), count=selectedTagIds.size;
  const clearBtn=$("clearChecks");
  if(selectionMode){
    btn.textContent=count?`Удалить выбранные (${count})`:"Удалить выбранные";
    btn.title=count?`Удалить выбранные теги: ${count}`:"Выбери теги для удаления";
    btn.disabled=!count;

    const total=data.length;
    const allSelected=total>0 && selectedTagIds.size===total;
    clearBtn.textContent=allSelected?"Снять все":"Отметить все";
    clearBtn.title=allSelected
      ?"Снять выбор со всех тегов для копирования"
      :"Выбрать все теги для копирования";
    clearBtn.disabled=!total;
  }else{
    btn.textContent="Удалить теги";
    btn.title="Удалить все теги текущей страницы";
    btn.disabled=false;

    clearBtn.textContent="Снять отметки";
    clearBtn.title="Снять все отметки «Выполнено»";
    clearBtn.disabled=false;
  }
}

async function copyTags(ids){
  const wanted=new Set(ids);
  const items=data.filter(item=>wanted.has(item.id));
  if(!items.length)return;
  const lines=items.map(item=>{
    const tag=String(item.tag||"").trim();
    const task=String(item.task||"").trim().replace(/\\s*[\\r\\n]+\\s*/g," ");
    return task ? `${tag} — ${task}` : tag;
  });
  const text=lines.join("\n");
  try{
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else{
      const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
    }
    showToast(items.length===1?`Скопирован тег${items[0].task?" с заданием":""}: ${items[0].tag}`:`Скопировано тегов с заданиями: ${items.length}`);
  }catch(_){showToast("Не удалось скопировать тег");}
}

function enterTagSelection(id){
  setSelectionMode(true,id);
  if(navigator.vibrate)navigator.vibrate(25);
}

function startLongPress(id){
  cancelLongPress();
  longPressTriggered=false;
  longPressTimer=setTimeout(()=>{
    longPressTriggered=true;
    enterTagSelection(id);
  },650);
}

function cancelLongPress(){
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}
}

function openEdit(id){
  editId=id;
  const item=data.find(x=>x.id===id);
  if(!item)return;
  modalTitle.textContent="Редактировать прибор";
  setAddMode("manual");
  $("addChoice").style.display="none";
  tagInput.value=item.tag;
  manualTaskInput.value=item.task||"";
  statusInput.value=item.done?"done":"todo";
  deleteBtn.style.display="block";
  overlay.classList.add("show");
  setTimeout(()=>tagInput.focus(),50);
}

function closeModal(){overlay.classList.remove("show");editId=null;}

function unitFromTag(tag){
  const m=String(tag||"").trim().match(/^(\d{4})-/);
  return m ? m[1] : "";
}

function tagKey(v){
  return String(v||"").toUpperCase().replace(/[–—−_]/g,"-").replace(/\s+/g,"").trim();
}

function findDuplicateTag(tag,ignoreId=null){
  const key=tagKey(tag);
  return data.find(item=>tagKey(item.tag)===key && item.id!==ignoreId)||null;
}

function openDuplicateDialog(duplicate,pending){
  pendingDuplicate={duplicateId:duplicate.id,pending};
  $("duplicateMessage").innerHTML=`Тег <strong>${escapeHtml(pending.tag)}</strong> уже есть в списке (позиция №${duplicate.id}, ${escapeHtml(duplicate.tag)}).<br><br>Измени новый тег или удали существующую запись, если она больше не нужна.`;
  $("duplicateOverlay").classList.add("show");
}

function closeDuplicateDialog(){pendingDuplicate=null;$("duplicateOverlay").classList.remove("show");}

function saveModal(){
  const tag=tagInput.value.trim().toUpperCase();
  const unit=unitFromTag(tag);
  if(!tag){showToast("Заполни Tag Number");return;}
  if(!unit){showToast("Unit определяется автоматически из Tag Number");return;}
  const done=statusInput.value==="done";
  const task=manualTaskInput.value.trim();
  const duplicate=findDuplicateTag(tag,editId);
  if(duplicate){openDuplicateDialog(duplicate,{unit,tag,done,task,editId});return;}
  if(editId!==null){
    const item=data.find(x=>x.id===editId);
    if(item){item.unit=unit;item.tag=tag;item.done=done;item.task=task;}
  }else{
    const max=data.reduce((m,x)=>Math.max(m,Number(x.id)||0),0);
    data.push({id:max+1,unit,tag,done,task});
  }
  save();closeModal();render();showToast(editId===null?"Прибор добавлен":"Сохранено");
}

async function deleteCurrent(){
  if(editId===null)return;
  const item=data.find(x=>x.id===editId);
  if(!item)return;
  if(!await askConfirm(`Удалить ${item.tag}?`,"Удаление прибора","Удалить"))return;
  data=data.filter(x=>x.id!==editId);
  save();closeModal();render();showToast("Прибор удалён");
}

function showToast(text){
  const t=$("toast");t.textContent=text;t.classList.add("show");
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),1400);
}

function makeTimestamp(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function makeFileTimestamp(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${String(d.getFullYear()).slice(-2)}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
