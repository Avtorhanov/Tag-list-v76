
function safeGetStorage(key,fallback=null){
  try{const value=localStorage.getItem(key);return value===null?fallback:value;}
  catch(e){return fallback;}
}

function loadDocumentTitle(){
  const saved=(safeGetStorage(DOC_TITLE_KEY,"")||"").trim();
  // Migrate the previous built-in title; keep any user-defined title unchanged.
  if(saved==="КИП — чек-лист" || saved==="КИП — чек-лист • v67" || saved==="Tag-list"){
    safeSetStorage(DOC_TITLE_KEY,DEFAULT_TITLE);
    safeSetStorage("kip-last-file-name",DEFAULT_TITLE);
    return DEFAULT_TITLE;
  }
  return saved || DEFAULT_TITLE;
}

function applyDocumentTitle(){
  const el=$("docTitle");
  if(el) el.textContent=docTitle;
  document.title=docTitle;
  const appleMeta=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(appleMeta) appleMeta.setAttribute("content",docTitle);
  const appMeta=document.querySelector('meta[name="application-name"]');
  if(appMeta) appMeta.setAttribute("content",docTitle);
}

function saveDocumentTitle(){
  const el=$("docTitle");
  const value=(el?.textContent||"").replace(/\s+/g," ").trim();
  docTitle=value||DEFAULT_TITLE;
  safeSetStorage(DOC_TITLE_KEY,docTitle);
  safeSetStorage("kip-last-file-name",docTitle);
  const page=getActivePage();if(page){page.updatedAt=new Date().toISOString();persistPages();}
  applyDocumentTitle();
  renderLastSaved();
}

function cloneInitial(){ return INITIAL_DATA.map(x => ({...x, task:String(x.task||"")})); }

function normalizeItem(value,index=0){
  const x=(value&&typeof value==="object")?value:{};
  const numericId=Number(x.id);
  return {
    id:Number.isFinite(numericId)&&numericId>=0?numericId:index+1,
    unit:String(x.unit??"").trim(),
    tag:String(x.tag??"").trim(),
    done:x.done===true || x.done===1 || x.done==="true",
    task:String(x.task??"")
  };
}

function cloneItems(items){
  return Array.isArray(items) ? items.map((x,i)=>normalizeItem(x,i)).filter(x=>x.tag || x.unit || x.task) : [];
}

function safeSetStorage(key,value){
  try{localStorage.setItem(key,value);return true;}
  catch(e){console.warn("Tag list: local storage write failed",e);return false;}
}

function loadData(){
  try{
    const raw = safeGetStorage(DATA_KEY,null);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length) return cloneItems(parsed);
    }
  }catch(e){}
  const fresh = cloneInitial();
  safeSetStorage(DATA_KEY, JSON.stringify(fresh));
  return fresh;
}

function createPageId(){return `page-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}

function normalizePageName(value,fallback="Страница"){
  const base=String(value??"").replace(/\s+/g," ").trim().slice(0,60)||fallback;
  const used=new Set(pages.map(page=>String(page.name||"").trim().toLocaleLowerCase("ru-RU")));
  if(!used.has(base.toLocaleLowerCase("ru-RU")))return base;
  let n=2;
  while(used.has(`${base} (${n})`.toLocaleLowerCase("ru-RU")))n++;
  return `${base} (${n})`.slice(0,60);
}

function normalizeUniquePageNames(list){
  const used=new Set();
  return list.map((page,index)=>{
    const raw=String(page.name||`Страница ${index+1}`).replace(/\s+/g," ").trim()||`Страница ${index+1}`;
    let name=raw.slice(0,60), n=2;
    while(used.has(name.toLocaleLowerCase("ru-RU"))){
      const suffix=` (${n++})`;
      name=`${raw.slice(0,60-suffix.length)}${suffix}`;
    }
    used.add(name.toLocaleLowerCase("ru-RU"));
    return {...page,name};
  });
}

function loadPages(){
  try{
    const raw=safeGetStorage(PAGES_KEY,null);
    if(raw){
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length){
        const restored=normalizeUniquePageNames(parsed.map((page,index)=>({
          id:String(page.id||createPageId()),
          name:String(page.name||`Страница ${index+1}`).trim()||`Страница ${index+1}`,
          data:cloneItems(page.data),
          updatedAt:page.updatedAt||new Date().toISOString()
        })));
        safeSetStorage(PAGES_KEY,JSON.stringify(restored));
        return restored;
      }
    }
  }catch(e){}
  if(Array.isArray(INITIAL_PAGES) && INITIAL_PAGES.length){
    const restored=normalizeUniquePageNames(INITIAL_PAGES.map((page,index)=>({id:String(page.id||createPageId()),name:String(page.name||`Страница ${index+1}`).trim()||`Страница ${index+1}`,data:cloneItems(page.data),updatedAt:page.updatedAt||new Date().toISOString()})));
    safeSetStorage(PAGES_KEY,JSON.stringify(restored));
    return restored;
  }
  const first={id:createPageId(),name:"Основная страница",data:loadData(),updatedAt:new Date().toISOString()};
  safeSetStorage(PAGES_KEY,JSON.stringify([first]));
  return [first];
}

function loadActivePageId(){
  const stored=safeGetStorage(ACTIVE_PAGE_KEY,null);
  return pages.some(page=>page.id===stored) ? stored : pages[0].id;
}

function getActivePage(){return pages.find(page=>page.id===activePageId)||pages[0];}

function persistPages(){safeSetStorage(PAGES_KEY,JSON.stringify(pages));safeSetStorage(ACTIVE_PAGE_KEY,activePageId);}

function formatSaved(value){
  const date=new Date(value||0);
  if(Number.isNaN(date.getTime()))return "Сохранено на устройстве: —";
  return `Сохранено на устройстве: ${date.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}`;
}

function renderLastSaved(){
  const el=$("lastSaved"),page=getActivePage();
  if(el&&page)el.textContent=formatSaved(page.updatedAt);
}

function renderPages(){
  const strip=$("pageStrip");
  if(!strip)return;
  strip.innerHTML="";
  pages.forEach(page=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="pageChip"+(page.id===activePageId?" active":"")+(selectedPageIds.has(page.id)?" selected":"");
    if(page.id===activePageId) button.setAttribute("aria-current","page");
    button.title=pageManageMode?"Нажми для выбора страницы":"Нажми для открытия • удерживай для управления";
    if(pageManageMode){
      const mark=document.createElement("span");
      mark.className="pageChipMark";mark.textContent="✓";mark.setAttribute("aria-hidden","true");
      button.appendChild(mark);
    }
    const name=document.createElement("span");name.textContent=page.name;
    const count=document.createElement("span");count.className="pageCount";count.textContent=`• ${page.data.length}`;
    button.append(name,count);
    button.onclick=()=>{
      if(pageLongPressTriggered){pageLongPressTriggered=false;return;}
      if(pageManageMode){togglePageSelection(page.id);return;}
      selectPage(page.id);
    };
    button.addEventListener("selectstart",e=>e.preventDefault());
    button.addEventListener("dragstart",e=>e.preventDefault());
    let pressX=0,pressY=0;
    button.addEventListener("pointerdown",e=>{
      if(e.pointerType==="mouse" && e.button!==0)return;
      pressX=e.clientX;pressY=e.clientY;
      startPageLongPress(page.id);
    });
    button.addEventListener("pointermove",e=>{
      if(Math.abs(e.clientX-pressX)>10 || Math.abs(e.clientY-pressY)>10)cancelPageLongPress();
    });
    button.addEventListener("pointerup",cancelPageLongPress);
    button.addEventListener("pointercancel",cancelPageLongPress);
    button.addEventListener("contextmenu",e=>{e.preventDefault();cancelPageLongPress();enterPageManage(page.id,false);});
    strip.appendChild(button);
  });
  updatePageManageBar();
}

function startPageLongPress(id){
  cancelPageLongPress();
  pageLongPressTriggered=false;
  pageLongPressTimer=setTimeout(()=>{
    pageLongPressTimer=null;
    pageLongPressTriggered=true;
    enterPageManage(id,false);
    if(navigator.vibrate)navigator.vibrate(25);
  },650);
}

function cancelPageLongPress(){
  if(pageLongPressTimer){clearTimeout(pageLongPressTimer);pageLongPressTimer=null;}
}

function updatePageManageBar(){
  const bar=$("pageManageBar");
  if(!bar)return;
  bar.classList.toggle("show",pageManageMode);
  const edit=$("pageManageEdit"),del=$("pageManageDelete");
  if(edit){edit.disabled=selectedPageIds.size!==1;edit.style.opacity=selectedPageIds.size===1?"1":".45";}
  if(del){del.disabled=selectedPageIds.size===0;del.style.opacity=selectedPageIds.size?"1":".45";}
}

function enterPageManage(id,selectAll=false){
  pageManageMode=true;
  selectedPageIds=selectAll?new Set(pages.map(page=>page.id)):new Set([id]);
  renderPages();
  updatePageManageBar();
}

function exitPageManage(){
  pageManageMode=false;
  selectedPageIds.clear();
  closePageContextMenu();
  renderPages();
  updatePageManageBar();
}

function togglePageSelection(id){
  if(selectedPageIds.has(id))selectedPageIds.delete(id);
  else selectedPageIds.add(id);
  renderPages();
  updatePageManageBar();
}

function selectAllPages(){
  if(selectedPageIds.size===pages.length)selectedPageIds.clear();
  else selectedPageIds=new Set(pages.map(page=>page.id));
  renderPages();
  updatePageManageBar();
}

function editSelectedPage(){
  if(selectedPageIds.size!==1)return;
  const id=[...selectedPageIds][0],page=pages.find(item=>item.id===id);
  if(!page)return;
  const name=prompt("Название страницы",page.name);
  if(name===null)return;
  const clean=name.replace(/\s+/g," ").trim();
  if(!clean){showToast("Название не изменено");return;}
  page.name=normalizePageName(clean,page.name);page.updatedAt=new Date().toISOString();
  persistPages();exitPageManage();showToast("Название страницы сохранено");
}

function editPageById(id){
  const page=pages.find(item=>item.id===id);
  if(!page)return;
  const name=prompt("Название страницы",page.name);
  if(name===null)return;
  const clean=name.replace(/\s+/g," ").trim();
  if(!clean){showToast("Название не изменено");return;}
  page.name=normalizePageName(clean,page.name);page.updatedAt=new Date().toISOString();
  persistPages();closePageContextMenu();renderPages();showToast("Название страницы сохранено");
}

async function deleteSelectedPages(){
  const ids=[...selectedPageIds];
  resetTagSelection();
  if(!ids.length)return;
  pages=pages.filter(page=>!ids.includes(page.id));
  if(!pages.length){
    const fresh={id:createPageId(),name:"Основная страница",data:[],updatedAt:new Date().toISOString()};
    pages=[fresh];activePageId=fresh.id;data=fresh.data;
  }else if(!pages.some(page=>page.id===activePageId)){
    const next=pages[0];activePageId=next.id;data=next.data;
  }
  filter="all";query="";
  if($("search"))$("search").value="";
  persistPages();pageManageMode=false;selectedPageIds.clear();closePageContextMenu();render();
  showToast(ids.length===1?"Страница удалена":"Страницы удалены");
}

function deletePageById(id){
  selectedPageIds=new Set([id]);
  deleteSelectedPages();
}

function closePageContextMenu(){
  const menu=$("pageContextMenu");
  if(menu){menu.classList.remove("show");menu.setAttribute("aria-hidden","true");}
  contextPageId=null;
}

function resetTagSelection(){
  selectionMode=false;
  selectedTagIds.clear();
  document.body.classList.remove("selection-mode-active");
}

function selectPage(id){
  const page=pages.find(item=>item.id===id);
  if(!page)return;
  resetTagSelection();
  activePageId=page.id;
  data=page.data;
  filter="all";query="";
  if($("search"))$("search").value="";
  persistPages();render();
}

function createPage(){
  const proposed=`Страница ${pages.length+1}`;
  const name=prompt("Название новой страницы",proposed);
  if(name===null)return;
  const clean=normalizePageName(name.replace(/\s+/g," ").trim()||proposed,proposed);
  const page={id:createPageId(),name:clean,data:[],updatedAt:new Date().toISOString()};
  pages.push(page);resetTagSelection();activePageId=page.id;data=page.data;filter="all";query="";
  if($("search"))$("search").value="";
  persistPages();render();showToast("Создана новая страница");
}

function renameActivePage(){
  const page=getActivePage();if(!page)return;
  const name=prompt("Название текущей страницы",page.name);
  if(name===null)return;
  const clean=name.replace(/\s+/g," ").trim();
  if(!clean){showToast("Название не изменено");return;}
  page.name=normalizePageName(clean,page.name);page.updatedAt=new Date().toISOString();persistPages();render();showToast("Название страницы сохранено");
}

async function deleteActivePage(){
  resetTagSelection();
  const page=getActivePage();
  if(!page)return;
  const isLast=pages.length===1;
  const message=isLast
    ? `Удалить страницу «${page.name}»? Это последняя страница. После удаления будет создана пустая новая страница.`
    : `Удалить страницу «${page.name}»? Все приборы и задания на этой странице будут удалены.`;
  if(!await askConfirm(message,"Удаление страницы","Удалить"))return;
  const index=pages.findIndex(item=>item.id===page.id);
  pages=pages.filter(item=>item.id!==page.id);
  if(!pages.length){
    const fresh={id:createPageId(),name:"Основная страница",data:[],updatedAt:new Date().toISOString()};
    pages=[fresh];
    activePageId=fresh.id;
    data=fresh.data;
  }else{
    const next=pages[Math.min(index,pages.length-1)];
    activePageId=next.id;
    data=next.data;
  }
  filter="all";query="";
  if($("search"))$("search").value="";
  persistPages();render();showToast(isLast?"Страница удалена • создана новая пустая":"Страница удалена");
}

function save(){
  const page=getActivePage();
  if(page){
    page.data=data;
    page.updatedAt=new Date().toISOString();
  }
  persistPages();
  safeSetStorage(DATA_KEY, JSON.stringify(data));
  renderLastSaved();
}

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>save(),350);
}

function flushSave(){
  clearTimeout(saveTimer);
  save();
}


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

function autosizeTaskTextarea(ta,maxPx){
  if(!ta)return;
  const cs=getComputedStyle(ta);
  const line=parseFloat(cs.lineHeight)||20;
  const min=Math.max(50,line+18);
  const max=maxPx||125;
  ta.style.height="auto";
  const desired=Math.min(max,Math.max(min,ta.scrollHeight));
  ta.style.height=desired+"px";
  ta.scrollTop=0;
}

function setTaskEditor(row,item,open,focus=false){
  const editor=row.querySelector(".taskEditorWrap"),toggle=row.querySelector(".taskToggle"),saveBtn=row.querySelector(".taskSave"),ta=row.querySelector(".taskBox textarea");
  if(!editor||!toggle||!saveBtn)return;
  editor.classList.toggle("open",open);
  toggle.classList.toggle("open",open);
  saveBtn.classList.toggle("show",open);
  toggle.setAttribute("aria-expanded",String(open));
  if(open&&ta){
    editor.classList.remove("focused");
    requestAnimationFrame(()=>{autosizeTaskTextarea(ta,125);ta.scrollTop=0;if(focus){ta.focus();editor.classList.add("focused");autosizeTaskTextarea(ta,170);ta.scrollTop=0;}});
  }else if(ta){ta.style.height="";ta.scrollTop=0;}
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
  const markBtn=$("markAllDone");
  const clearBtn=$("clearChecks");
  if(selectionMode){
    btn.textContent=count?`Удалить выбранные (${count})`:"Удалить выбранные";
    btn.title=count?`Удалить выбранные теги: ${count}`:"Выбери теги для удаления";
    btn.disabled=!count;

    const total=data.length;
    const allSelected=total>0 && selectedTagIds.size===total;
    markBtn.textContent="Выбрать все";
    markBtn.title="Выбрать все теги для копирования";
    markBtn.disabled=!total || allSelected;

    clearBtn.textContent="Снять выбор";
    clearBtn.title="Снять выбор со всех тегов для копирования";
    clearBtn.disabled=!selectedTagIds.size;
  }else{
    btn.textContent="Удалить теги";
    btn.title="Удалить все теги текущей страницы";
    btn.disabled=false;

    markBtn.textContent="Отметить все";
    markBtn.title="Отметить все теги как выполненные";
    markBtn.disabled=!data.length || data.every(item=>item.done);

    clearBtn.textContent="Снять отметки";
    clearBtn.title="Снять все отметки «Выполнено»";
    clearBtn.disabled=!data.length || data.every(item=>!item.done);
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

function closeModal(){
  const active=document.activeElement;
  if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) active.blur();
  overlay.classList.remove("show");
  editId=null;
}

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


async function buildExportHtml(exportData=data, exportPages=pages){
  const stamp=makeTimestamp();
  const currentJson=JSON.stringify(exportData,null,2).replace(/</g,"\u003c");
  const pagesJson=JSON.stringify(exportPages,null,2).replace(/</g,"\u003c");
  const uniqueKey="kip-checklist-saved-"+Date.now();
  const clone=document.documentElement.cloneNode(true);
  ["overlay","saveOverlay","exportOverlay","fontOverlay","dryListOverlay","fullReportOverlay","confirmOverlay"].forEach(id=>{
    const el=clone.querySelector("#"+id);
    if(el){el.classList.remove("show");el.style.removeProperty("display");}
  });
  ["importList","fileImportList"].forEach(id=>{const el=clone.querySelector("#"+id);if(el)el.innerHTML="";});
  ["importActions","fileImportActions"].forEach(id=>{const el=clone.querySelector("#"+id);if(el)el.style.display="none";});
  const status=clone.querySelector("#fileImportStatus");if(status)status.textContent="";
  const fp=clone.querySelector("#fileProgressWrap");if(fp)fp.style.display="none";
  const toast=clone.querySelector("#toast");if(toast){toast.className="toast";toast.textContent="";}
  const ocrStatus=clone.querySelector("#ocrStatus");if(ocrStatus)ocrStatus.textContent="";
  const progress=clone.querySelector("#ocrProgressWrap");if(progress)progress.style.display="none";
  const pageContext=clone.querySelector("#pageContextMenu");if(pageContext){pageContext.classList.remove("show");pageContext.style.display="none";}

  // Export is deliberately self-contained: inline CSS and every JS module so the
  // saved HTML keeps working without the original project directory.
  const moduleNames=["storage.js","tags.js","export.js","ocr-utils.js","import.js","ui.js","app.js"];
  const [cssText,...allJs]=await Promise.all([
    fetch("./css/app.css").then(r=>{if(!r.ok)throw new Error("Не удалось прочитать CSS");return r.text();}),
    ...moduleNames.map(name=>fetch(`./js/${name}`).then(r=>{if(!r.ok)throw new Error(`Не удалось прочитать ${name}`);return r.text();})),
    fetch("./js/ocr.js").then(r=>{if(!r.ok)throw new Error("Не удалось прочитать ocr.js");return r.text();})
  ]);
  const moduleTexts=allJs.slice(0,moduleNames.length);
  const ocrText=allJs[moduleNames.length];
  const head=clone.querySelector("head");
  clone.querySelectorAll('link[rel="stylesheet"]').forEach(el=>{
    if(el.getAttribute("href")?.endsWith("app.css")){
      const style=document.createElement("style");style.textContent=cssText;el.replaceWith(style);
    }
  });
  const moduleTextsByName=new Map(moduleNames.map((name,index)=>[name,moduleTexts[index]]));
  const moduleScripts=[...clone.querySelectorAll('script[src^="./js/"]')];
  moduleScripts.forEach(el=>{
    const name=(el.getAttribute("src")||"").split("/").pop();
    const script=document.createElement("script");
    script.textContent=moduleTextsByName.get(name)||"";
    el.replaceWith(script);
  });
  // The source document does not load OCR initially; insert the OCR module immediately before app.js.
  const ocrInline=document.createElement("script");
  ocrInline.textContent=ocrText||"";
  const scriptsNow=[...clone.querySelectorAll("script")];
  const last=scriptsNow[scriptsNow.length-1];
  if(last)last.before(ocrInline);

  let exported="<!doctype html>\n"+clone.outerHTML;
  const escapedTitle=JSON.stringify(docTitle).replace(/</g,"\u003c");
  exported=exported.replace(/<title>.*?<\/title>/s,`<title>${docTitle.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</title>`);
  exported=exported.replace(/const INITIAL_DATA = .*?;\s*const INITIAL_PAGES = .*?;\s*const DATA_KEY = ".*?";\s*const FONT_KEY = ".*?";\s*const FONT_FAMILY_KEY = ".*?";\s*const DOC_TITLE_KEY = ".*?";\s*const PAGES_KEY = ".*?";\s*const ACTIVE_PAGE_KEY = ".*?";\s*const THEME_KEY = ".*?";\s*const DEFAULT_TITLE = ".*?";/s,
    `const INITIAL_DATA = ${currentJson};\nconst INITIAL_PAGES = ${pagesJson};\nconst DATA_KEY = "${uniqueKey}";\nconst FONT_KEY = "kip-checklist-font-v1";\nconst FONT_FAMILY_KEY = "kip-checklist-font-family-v1";\nconst DOC_TITLE_KEY = "kip-checklist-title-v1";\nconst PAGES_KEY = "${uniqueKey}-pages";\nconst ACTIVE_PAGE_KEY = "${uniqueKey}-active-page";\nconst THEME_KEY = "${uniqueKey}-theme";\nconst DEFAULT_TITLE = ${escapedTitle};`);
  const selectedFamily=JSON.stringify(safeGetStorage(FONT_FAMILY_KEY,"system"));
  exported=exported.replace(/const DEFAULT_TITLE = .*?;/s,match=>match+`\nconst EXPORTED_FONT_FAMILY = ${selectedFamily};`);
  exported=exported.replace(/const savedFontFamily=localStorage.getItem\(FONT_FAMILY_KEY\)\|\|"system";/,'const savedFontFamily=typeof EXPORTED_FONT_FAMILY!=="undefined"?EXPORTED_FONT_FAMILY:(localStorage.getItem(FONT_FAMILY_KEY)||safeGetStorage(FONT_FAMILY_KEY,"system"));');
  return {html:exported,stamp};
}

async function openBlankNewDocument(){
  save();
  const blankPages=pages.map(page=>({...page,data:[]}));
  const {html:exported}=await buildExportHtml([],blankPages);
  let tab=null;
  try{tab=window.open("about:blank","_blank");}catch(_){}
  if(!tab){showToast("Браузер не разрешил открыть новую вкладку");return;}
  try{
    tab.document.open();
    tab.document.write(exported);
    tab.document.close();
    closeExportMenu();
    showToast("Новый пустой файл открыт");
  }catch(e){
    try{tab.close();}catch(_){}
    showToast("Не удалось открыть новый файл");
  }
}

function safeFileBase(name){
  return name.trim()
    .replace(/[\\/:*?"<>|]/g,"-")
    .replace(/\s+/g," ")
    .replace(/\.+$/,"") || "КИП-чек-лист";
}

function renderExportPageButtons(){
  const wrap=$("exportPageButtons");
  if(!wrap)return;
  wrap.innerHTML="";
  pages.forEach((page,index)=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="choice";
    button.innerHTML=`<span class="ico">${index===0?"⌂":"≡"}</span>${escapeHtml(page.name||`Страница ${index+1}`)}`;
    button.addEventListener("click",()=>sharePageReport(page.id));
    wrap.appendChild(button);
  });
}

function openExportMenu(){
  $("exportTitle").textContent="Сохранить / отправить";
  renderExportPageButtons();
  $("exportOverlay").classList.add("show");
}

function closeExportMenu(){ $("exportOverlay").classList.remove("show"); }

function reportDateTime(){
  return new Date().toLocaleString("ru-RU",{
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit"
  });
}

function cleanReportField(value){
  return String(value??"")
    .replace(/[\r\n\t]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function pageTitleForReport(page){
  const name=cleanReportField(page?.name);
  return name||"Без названия";
}

function reportPageHeader(page){
  return `${pageTitleForReport(page)}\n${reportDateTime()}`;
}

function formatReportItems(items,includeTasks=false){
  return items.map((item,index)=>{
    const tag=cleanReportField(item.tag)||"Без тега";
    const task=cleanReportField(item.task);
    return `${index+1}. ${tag}${includeTasks&&task?` — ${task}`:""}`;
  }).join("\n");
}

function buildPageTextReport(page,kind="all"){
  if(!page)return "";
  const done=page.data.filter(item=>item.done);
  const todo=page.data.filter(item=>!item.done);
  const tasks=page.data.filter(item=>!!cleanReportField(item.task));
  const sections=[];
  const addSection=(title,items,includeTasks=false)=>{
    if(items.length) sections.push(`${title}\n${formatReportItems(items,includeTasks)}`);
  };

  if(kind==="done") addSection("Выполненные",done);
  else if(kind==="todo") addSection("Невыполненные",todo);
  else if(kind==="task") addSection("Задания",tasks,true);
  else {
    // «Весь список» содержит только статусные разделы.
    // Задания доступны отдельным вариантом «Задания», чтобы одна позиция
    // с заданием не дублировалась одновременно в общем списке и в разделе заданий.
    addSection("Выполненные",done);
    addSection("Невыполненные",todo);
  }

  const body=sections.length?sections.join("\n\n"):"Нет данных";
  return `${pageTitleForReport(page)}\n\n${body}`;
}

function buildGroupedTextReport(kind="all"){
  // Для отправки всегда используется только открытая пользователем страница.
  return buildPageTextReport(getActivePage(),kind);
}

function buildTitlesReport(){
  return pages.map((page,index)=>`${index+1}. ${pageTitleForReport(page)}`).join("\n");
}

async function shareTextPayload(title,text){
  closeExportMenu();
  try{
    if(navigator.share){await navigator.share({title,text});showToast("Текст передан");return;}
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);showToast("Текст скопирован");return;}
    throw new Error("share-unavailable");
  }catch(e){if(e.name!=="AbortError")showToast("Не удалось передать текст");}
}

async function shareTextReport(kind){
  const labels={all:"Весь список",done:"Выполненные",todo:"Невыполненные",task:"Задания",pages:"Титулы"};
  const text=kind==="pages"?buildTitlesReport():buildPageTextReport(getActivePage(),kind);
  await shareTextPayload(`${docTitle} — ${labels[kind]}`,text);
}

async function sharePageReport(pageId){
  const page=pages.find(p=>p.id===pageId);
  if(!page)return;
  await shareTextPayload(`${pageTitleForReport(page)}`,buildPageTextReport(page,"all"));
}

async function shareCurrentDocument(){
  const {html:exported,stamp}=await buildExportHtml(data);
  const fileName=`${safeFileBase(docTitle)} — ${stamp}.html`;
  const file=new File([exported],fileName,{type:"text/html"});
  closeExportMenu();
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({title:fileName,files:[file]});
      showToast("Файл передан");return;
    }
    const url=URL.createObjectURL(file);
    const a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);showToast("Файл подготовлен");
  }catch(e){if(e.name!=="AbortError")showToast("Не удалось передать файл");}
}

function handleExportFile(){shareCurrentDocument();}


function normalizeOcrText(text){
  return String(text||'').toUpperCase()
    .replace(/[–—−_]/g,"-")
    .replace(/[ОO]/g,"O")
    .replace(/[ІI]/g,"I")
    .replace(/[Ё]/g,"E")
    .replace(/[\r\n]+/g,"\n");
}

function canonicalTag(s){
  const t=normalizeOcrText(s).replace(/[^A-Z0-9-]/g,"");
  const m=t.match(/(\d{4})-([A-Z]{2,8})-(\d{2,4})([A-Z]?)/);
  if(!m)return null;
  let n=m[3];
  if(n.length<3)n=n.padStart(3,"0");
  if(n.length>3)n=n.slice(-3);
  return `${m[1]}-${m[2]}-${n}${m[4]||""}`;
}

function extractTagsFromOCR(text){
  const n=normalizeOcrText(text), found=new Set();
  const loose=/(\d{4})\s*-?\s*([A-Z]{2,8})\s*-?\s*(\d{2,4})\s*([A-Z]?)\b/g;
  let m;
  while((m=loose.exec(n))){
    const t=canonicalTag(`${m[1]}-${m[2]}-${m[3]}${m[4]}`);
    if(t)found.add(t);
  }
  return [...found];
}

function knownTags(){ return data.map(x=>x.tag).filter(Boolean); }

function updateOcrConfigStatus(){
  const key=safeGetStorage('kipOcrSpaceKey','helloworld')||'helloworld';
  const backend=safeGetStorage('kipOcrApiUrl','')||'';
  if(backend) $("ocrConfigStatus").textContent='OCR.space Engine 2 → Engine 3 • используется настроенный backend';
  else if(key==='helloworld') $("ocrConfigStatus").textContent='OCR.space Engine 2 → Engine 3';
  else $("ocrConfigStatus").textContent='OCR.space Engine 2 → Engine 3 • API-ключ сохранён';
}

function setProgress(v){ $('ocrBar').style.width=Math.max(0,Math.min(100,v))+'%'; }

function setFileProgress(v){ const el=$("fileBar"); if(el) el.style.width=Math.max(0,Math.min(100,v))+'%'; }

function nextFrame(){ return new Promise(resolve=>requestAnimationFrame(()=>resolve())); }

function levenshtein(a,b){
  const m=a.length,n=b.length,prev=Array(n+1).fill(0),cur=Array(n+1).fill(0);
  for(let j=0;j<=n;j++)prev[j]=j;
  for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=n;j++)prev[j]=cur[j]}
  return prev[n];
}

function fuzzyKnownTag(tag){
  const all=knownTags(); if(!all.length)return tag;
  const exact=all.find(k=>tagKey(k)===tagKey(tag)); if(exact)return exact;
  const compact=x=>x.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const a=compact(tag); let best=null,bestD=99;
  for(const k of all){const b=compact(k);if(Math.abs(a.length-b.length)>1)continue;const d=levenshtein(a,b); if(d<bestD){bestD=d;best=k}}
  // Для фото разрешаем только небольшую OCR-ошибку. Большая дистанция создаёт ложное
  // сопоставление с ближайшим существующим тегом.
  return best && bestD<=1 ? best : tag;
}

function extractTagsSmart(text){
  const norm=normalizeOcrText(text).replace(/[—–_]/g,'-');
  const found=new Set();
  const re=/\b(\d{4})\s*-?\s*([A-Z]{2,8})\s*-?\s*([0-9OQILSZ]{2,4})\s*([A-Z0-9]?)\b/g;
  let m;
  while((m=re.exec(norm))){
    let num=m[3].replace(/O/g,'0').replace(/Q/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/Z/g,'2');
    const candidate=canonicalTag(`${m[1]}-${m[2]}-${num}${m[4]||''}`);
    if(candidate)found.add(fuzzyKnownTag(candidate));
  }
  return [...found];
}

function cleanImportedTask(value){
  let t=String(value||'')
    .replace(/\u00a0/g,' ')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/^[\s\-–—:;,.|•·]+|[\s\-–—:;,.|•·]+$/g,'')
    .trim();
  if(!t)return '';
  // Убираем служебные поля таблиц, которые не являются заданием.
  t=t.replace(/^\s*\d+\.\s*(?:✔️?|✓|☑|О|O|0)?\s*[—–:-|•·]*\s*/i,'')
     .replace(/^\s*(?:✔️?|✓|☑|О|O|0)\s*[—–:-|•·]+\s*/i,'')
     .replace(/\b(?:\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,' ')
     .replace(/\b(?:unit|установка)\s*\d{4}\b/gi,' ')
     .replace(/\b(?:кип\s*[—-]?\s*чек[- ]?лист|всего|выполнено|невыполнено)\b/gi,' ')
     .replace(/^\s*={2,}.*?={2,}\s*$/,' ')
     .replace(/\s{2,}/g,' ')
     .trim();
  if(!t)return '';
  if(/^\d{4}$/.test(t))return '';
  if(/^(?:страница|page)\s*\d+$/i.test(t))return '';
  if(/^(?:emerson|wika|chongqing\s+chuanyi|tesey|эмерсон)$/i.test(t))return '';
  if(/^[A-Z0-9][A-Z0-9 ._\/-]{1,45}$/.test(t) && !/[А-ЯЁа-яё]/.test(t))return '';
  if(/^[\d\s.,;:/()\-–—]+$/.test(t))return '';
  return t.slice(0,240);
}

function completeMeaningfulTaskPhrase(value){
  let t=String(value||"").replace(/\s+/g," ").trim();
  if(!t)return "";
  // Не угадываем отсутствующие технические данные. Дополняем только очевидные
  // производственные фразы, когда начало фразы однозначно указывает на действие.
  const completions=[
    [/\bнет\s+теговой\s+би\b/i,"нет теговой бирки"],
    [/\bнет\s+обратно\b/i,"нет обратной связи"],
    [/\bнет\s+обратн\w*\b/i,"нет обратной связи"],
    [/\bнет\s+питани\w*\b/i,"нет питания"],
    [/\bнет\s+связ\w*\b/i,"нет связи"],
    [/\bнет\s+прибор\w*\b/i,"нет прибора"],
    [/\bнет\s+датчик\w*\b/i,"нет датчика"],
    [/\bнет\s+кабел\w*\b/i,"нет кабеля"],
    [/\bнет\s+воздух\w*\b/i,"нет воздуха"],
    [/\bнет\s+пневм\w*\b/i,"нет пневмопитания"]
  ];
  for(const [re,replacement] of completions){if(re.test(t))t=t.replace(re,replacement);}
  return t;
}

function extractMeaningfulWords(value){
  const t=String(value||"").replace(/\s+/g," ").trim();
  if(!t)return "";
  // Сохраняем цельные слова и короткие технические обозначения, удаляя
  // отдельные OCR-фрагменты без самостоятельного смысла.
  const tokens=t.split(" ").filter(Boolean);
  const kept=tokens.filter(tok=>{
    const clean=tok.replace(/^[^A-Za-zА-ЯЁа-яё0-9]+|[^A-Za-zА-ЯЁа-яё0-9%№/.-]+$/g,"");
    if(!clean)return false;
    if(/^[^A-Za-zА-ЯЁа-яё0-9]+$/.test(clean))return false;
    if(clean.length===1 && !/[А-ЯЁа-яёA-Za-z0-9]/.test(clean))return false;
    return true;
  });
  return kept.join(" ");
}

function taskLikeText(value){
  let t=cleanImportedTask(value);
  if(!t)return '';
  t=extractMeaningfulWords(t);
  if(!t)return '';
  t=completeMeaningfulTaskPhrase(t);
  const hasMeaning=/[А-ЯЁа-яё]/.test(t) || /\b(?:check|replace|repair|broken|sensor|install|verify|change|перенастро|замен|провер|оборван|неисправ|сенсор|датчик|ремонт|монтаж|клапан|соленоид|манифольд|утечк|давлен|бирк|шильдик|кабель|муфт|болт|высот|фото|устран|погнут|клин|заед|связ|HART|прибор|питани|пневм|воздух)\b/i.test(t);
  return hasMeaning?t.slice(0,240):'';
}

function normalizeDoneMark(value){
  const v=String(value??'').trim().toLowerCase();
  if(!v)return false;
  return /^(✓|✔|☑|☒|✕|✖|×|\+|v|да|yes|true|done|готово|выполнено|1)$/i.test(v);
}

function stripTagFromContext(text){
  let t=String(text||'');
  t=t.replace(/\b\d{4}\s*-?\s*[A-ZА-ЯЁ]{2,8}\s*-?\s*[0-9OQILSZ]{2,4}\s*[A-ZА-ЯЁ]?\b/gi,' ');
  return cleanImportedTask(t);
}

function isNoiseImportLine(line){
  const t=String(line||'').trim();
  if(!t)return true;
  if(/^(?:кип\s*[—-]?\s*чек[- ]?лист|всего\s*:|выполнено\s*:|невыполнено\s*:|===|---|добавить|выполнено)$/i.test(t))return true;
  if(/^(?:основная\s+страница|страница\s+\d+)$/i.test(t))return true;
  return false;
}

function extractJsonTagRecords(text){
  const raw=String(text||'').trim();
  if(!raw || !/^[\[{]/.test(raw))return [];
  let parsed;try{parsed=JSON.parse(raw)}catch(_){return []}
  const out=[];
  const walk=(node)=>{
    if(Array.isArray(node)){node.forEach(walk);return;}
    if(!node || typeof node!=='object')return;
    const keys=Object.keys(node);
    const tagKeyName=keys.find(k=>/^(tag|тег|tag_number|tagNumber)$/i.test(k));
    if(tagKeyName){
      const rawTag=String(node[tagKeyName]??'').trim();
      const m=rawTag.match(/(\d{4})\s*-?\s*([A-ZА-ЯЁ]{2,8})\s*-?\s*([0-9OQILSZ]{2,4})\s*([A-ZА-ЯЁ]?)/i);
      if(m){
        const num=m[3].toUpperCase().replace(/O/g,'0').replace(/Q/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/Z/g,'2');
        const tag=canonicalTag(`${m[1]}-${m[2]}-${num}${m[4]||''}`);
        if(tag){
          const taskKey=keys.find(k=>/^(task|задание|assignment|note|комментарий|comment)$/i.test(k));
          const doneKey=keys.find(k=>/^(done|completed|complete|выполнено|статус|status)$/i.test(k));
          out.push({unit:tag.slice(0,4),tag,done:normalizeDoneMark(node[doneKey]),task:taskLikeText(node[taskKey]??'')});
        }
      }
    }
    keys.forEach(k=>walk(node[k]));
  };
  walk(parsed);
  return out;
}

function extractTagRecordsFromText(text){
  const jsonRecords=extractJsonTagRecords(text);
  if(jsonRecords.length){
    const map=new Map();
    for(const r of jsonRecords){const key=tagKey(r.tag),prev=map.get(key);if(!prev)map.set(key,r);else{prev.done=prev.done||r.done;prev.task=prev.task||r.task;}}
    return [...map.values()];
  }
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  const records=[];
  const tagRe=/\b(\d{4})\s*-?\s*([A-ZА-ЯЁ]{2,8})\s*-?\s*([0-9OQILSZ]{2,4})\s*([A-ZА-ЯЁ]?)\b/gi;
  let current=null;
  for(const rawLine of lines){
    const line=String(rawLine||'').trim();
    if(!line)continue;
    const matches=[...line.matchAll(tagRe)];
    if(matches.length){
      for(let i=0;i<matches.length;i++){
        const m=matches[i];
        let num=m[3].toUpperCase().replace(/O/g,'0').replace(/Q/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/Z/g,'2');
        const tag=canonicalTag(`${m[1]}-${m[2]}-${num}${m[4]||''}`);
        if(!tag)continue;
        const start=m.index+m[0].length;
        const end=i+1<matches.length?matches[i+1].index:line.length;
        const after=line.slice(start,end);
        const before=i===0?line.slice(0,m.index):'';
        const context=stripTagFromContext(`${before} ${after}`);
        const markContext=`${before} ${after}`;
        const done=/(^|[\s|;,:\t])(✓|✔|☑|☒|✕|✖|×|\+|v|да|yes|true|done|выполнено|готово)(?=[\s|;,:\t]|$)/i.test(markContext)
          ||/[✓✔☑☒✕✖×]/.test(markContext)
          || /(^|\s)[+v]\s*$/i.test(markContext.trim());
        current={unit:tag.slice(0,4),tag,done,task:taskLikeText(context)};
        records.push(current);
      }
    }else if(current && !isNoiseImportLine(line)){
      const continuation=taskLikeText(line.replace(/^[\-–—:|•]+/,'').trim());
      if(continuation){
        const combined=cleanImportedTask(`${current.task} ${continuation}`);
        current.task=completeMeaningfulTaskPhrase(combined).slice(0,240);
      }
    }
  }
  const map=new Map();
  for(const r of records){
    const key=tagKey(r.tag),prev=map.get(key);
    if(!prev)map.set(key,r);
    else{
      prev.done=prev.done||r.done;
      if(r.task)prev.task=prev.task?cleanImportedTask(`${prev.task} ${r.task}`):r.task;
    }
  }
  return [...map.values()].map(r=>({...r,task:cleanImportedTask(r.task)}));
}

async function imageToJpegBlob(file,maxWidth=2400,maxHeight=1900,quality=.88){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=async()=>{
      try{
        const scale=Math.min(1,maxWidth/img.naturalWidth,maxHeight/img.naturalHeight);
        const c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(img.naturalWidth*scale));
        c.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=c.getContext("2d",{alpha:false});
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
        ctx.drawImage(img,0,0,c.width,c.height);
        const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",quality));
        URL.revokeObjectURL(url);
        if(!blob)throw new Error("Не удалось подготовить изображение");
        resolve({blob,width:c.width,height:c.height});
      }catch(e){URL.revokeObjectURL(url);reject(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Не удалось открыть изображение"))};
    img.src=url;
  });
}

async function makeVisionTiles(file){
  const base=await imageToJpegBlob(file,2400,1900,.88);
  const img=await new Promise((resolve,reject)=>{
    const el=new Image(),url=URL.createObjectURL(base.blob);
    el.onload=()=>{URL.revokeObjectURL(url);resolve(el)};
    el.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Не удалось подготовить фрагменты фото"))};
    el.src=url;
  });
  // Для длинных/широких таблиц анализируем перекрывающиеся фрагменты.
  // Это повышает шанс увидеть мелкие отметки слева/справа от тега и не ломает
  // обычные короткие фото: для них остаётся один запрос.
  const W=base.width,H=base.height;
  if(W<=1900 && H<=1500)return [base.blob];
  const tileW=Math.min(1700,W),tileH=Math.min(1450,H),overlap=180;
  const xs=W<=tileW?[0]:[0,Math.max(0,W-tileW)];
  const ys=H<=tileH?[0]:[0,Math.max(0,H-tileH)];
  const tiles=[];
  for(const y of [...new Set(ys)]) for(const x of [...new Set(xs)]){
    const w=Math.min(tileW,W-x),h=Math.min(tileH,H-y);
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const ctx=c.getContext("2d",{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,x,y,w,h,0,0,w,h);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.9));
    if(blob)tiles.push(blob);
    if(tiles.length>=6)break;
  }
  return tiles.length?tiles:[base.blob];
}

async function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{const v=String(reader.result||"");resolve(v.includes(",")?v.split(",")[1]:v)};
    reader.onerror=()=>reject(new Error("Не удалось подготовить фото"));
    reader.readAsDataURL(blob);
  });
}


function setAddMode(mode){
  addMode=mode;
  overlay.classList.toggle("import-mode",mode==="camera"||mode==="photo"||mode==="file");
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
    const task=document.createElement("textarea");task.className="importTask";task.rows=1;task.placeholder="Опишите задание";task.value=candidate.task||"";taskWrap.appendChild(task);
    taskToggle.addEventListener("click",()=>{const open=taskWrap.classList.toggle("open");taskToggle.setAttribute("aria-expanded",String(open));if(open)setTimeout(()=>{task.scrollTop=0;autosizeTaskTextarea(task,104);task.focus();requestAnimationFrame(()=>task.scrollTop=0);},20);});
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


function getFontOption(id){return FONT_OPTIONS.find(x=>x.id===id)||FONT_OPTIONS[0];}

function applyFontFamily(id){
  const option=getFontOption(id);
  document.documentElement.style.setProperty("--appFont",option.family);
  safeSetStorage(FONT_FAMILY_KEY,option.id);
  const btn=$("fontBtn");
  if(btn){btn.title=`Шрифт: ${option.name}`;btn.setAttribute("aria-label",`Выбрать шрифт. Сейчас: ${option.name}`);}
}

function cycleFont(){
  const current=safeGetStorage(FONT_FAMILY_KEY,"system")||"system";
  const idx=FONT_OPTIONS.findIndex(x=>x.id===current);
  const next=FONT_OPTIONS[(idx+1+FONT_OPTIONS.length)%FONT_OPTIONS.length];
  applyFontFamily(next.id);
  const bubble=$("fontBubble");
  bubble.textContent=next.name;
  bubble.classList.add("show");
  clearTimeout(cycleFont.timer);
  cycleFont.timer=setTimeout(()=>bubble.classList.remove("show"),850);
}

function openDryReport(kind){
  const labels={all:"Весь список",done:"Выполненные",todo:"Невыполненные",task:"Задания"};
  const text=kind==="all"?buildGroupedTextReport("all"):buildGroupedTextReport(kind);
  $("dryListOverlay").classList.remove("show");
  $("fullReportTitle").textContent=`Сухой список · ${labels[kind]||""}`;
  $("fullReportText").textContent=text;
  $("fullReportOverlay").classList.add("show");
}

function closeDryReport(){
  const active=document.activeElement;
  if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) active.blur();
  $("fullReportOverlay").classList.remove("show");
}

function askConfirm(message,title="Подтверждение",okText="Удалить"){
  $("confirmTitle").textContent=title;
  $("confirmMessage").innerHTML=escapeHtml(message).replace(/\n/g,"<br>");
  $("confirmOk").textContent=okText;
  $("confirmOverlay").classList.add("show");
  return new Promise(resolve=>{confirmResolver=resolve;});
}

function finishConfirm(result){$("confirmOverlay").classList.remove("show");const r=confirmResolver;confirmResolver=null;if(r)r(result);}

function applyTheme(theme){
  const selected=THEME_ORDER.includes(theme)?theme:"light";
  document.documentElement.dataset.theme=selected;
  safeSetStorage(THEME_KEY,selected);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content={light:"#f5f7fa",navy:"#0d1726",violet:"#171124",green:"#0d211e"}[selected];
  const icon=$("themeIcon");
  if(icon)icon.textContent=THEME_ICON[selected];
  const btn=$("themeBtn");
  if(btn){btn.title=`Тема: ${selected}. Нажми для смены`;btn.setAttribute("aria-label",`Сменить тему. Сейчас: ${selected}`);}
}

function cycleTheme(){
  const current=safeGetStorage(THEME_KEY,"light")||"light";
  const next=THEME_ORDER[(THEME_ORDER.indexOf(current)+1)%THEME_ORDER.length];
  applyTheme(next);
}

function refreshAfterViewportChange(){
  clearTimeout(viewportRefreshTimer);
  viewportRefreshTimer=setTimeout(()=>{
    document.documentElement.style.setProperty("--viewport-h", `${window.innerHeight}px`);
    if(!document.activeElement || !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){
      renderTabs(); renderList();
    }
  },80);
}

function isStandaloneApp(){
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function hideInstallButton(){
  deferredInstallPrompt=null;
  if(installAppBtn) installAppBtn.hidden=true;
}

function showInstallFallback(){
  const ua=navigator.userAgent||"";
  const isiOS=/iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  if(isiOS){
    showToast("Установка на iPhone: нажми «Поделиться» → «На экран „Домой“»");
  }else{
    showToast("Установка через кнопку сейчас недоступна. Открой меню браузера и выбери «Установить приложение».");
  }
}


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
    for(const engine of ['2','3']){
      try{
        $("ocrStatus").textContent=engine==='2' ? "OCR.space Engine 2…" : "Engine 2 не сработал — пробую Engine 3…";
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
    task.className='importTask'; task.rows=1; task.placeholder='Опишите задание'; task.value=meta.task||'';
    task.setAttribute('aria-label',`Задание для ${tag}`); taskWrap.appendChild(task);

    taskToggle.addEventListener('click',()=>{
      const open=taskWrap.classList.toggle('open');
      taskToggle.setAttribute('aria-expanded',String(open));
      taskToggle.classList.toggle('hasTask',!!task.value.trim());
      taskToggle.title=task.value.trim()?'Задание: есть запись':'Задание';
      if(open)setTimeout(()=>{task.scrollTop=0;autosizeTaskTextarea(task,104);task.focus();requestAnimationFrame(()=>task.scrollTop=0);},20);
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


const INITIAL_DATA = [];
const INITIAL_PAGES = null;
const DATA_KEY = "kip-checklist-v56";
const FONT_KEY = "kip-checklist-font-v1";
const FONT_FAMILY_KEY = "kip-checklist-font-family-v1";
const DOC_TITLE_KEY = "kip-checklist-title-v1";
const PAGES_KEY = "kip-checklist-pages-v56";
const ACTIVE_PAGE_KEY = "kip-checklist-active-page-v56";
const THEME_KEY = "kip-checklist-theme-v56";
const DEFAULT_TITLE = "Tag list";

// Не даём браузеру превращать вертикальное вытягивание страницы в pull-to-refresh,
// если движок поддерживает overscroll-behavior. Обычный вертикальный скролл при этом сохраняется.
try{document.documentElement.style.overscrollBehaviorY="none";document.body.style.overscrollBehaviorY="none";}catch(_){}

let docTitle = loadDocumentTitle();
let pages = loadPages();
let activePageId = loadActivePageId();
let data = getActivePage().data;
let filter = "all";
let query = "";
let pageManageMode = false;
let selectedPageIds = new Set();
let pageLongPressTimer = null;
let pageLongPressTriggered = false;
let editId = null;
let selectionMode = false;
let selectedTagIds = new Set();
let longPressTimer = null;
let longPressTriggered = false;
let pendingDuplicate = null;
let saveTimer = null;

const $ = id => document.getElementById(id);

// v68 UX: блокируем прокрутку основного списка при открытом модальном окне,
// сохраняя текущую позицию страницы. Сам .sheet остаётся прокручиваемым.
let modalScrollY = 0;
let modalLocked = false;
function updateModalScrollLock(){
  const open = !!document.querySelector(".overlay.show");
  if(open && !modalLocked){
    modalScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.modalScrollY = String(modalScrollY);
    document.body.style.position = "fixed";
    document.body.style.top = `-${modalScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.classList.add("modal-open");
    modalLocked = true;
  }else if(!open && modalLocked){
    document.body.classList.remove("modal-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    const y = Number(document.body.dataset.modalScrollY || modalScrollY || 0);
    delete document.body.dataset.modalScrollY;
    modalLocked = false;
    requestAnimationFrame(()=>window.scrollTo(0,y));
  }
}

const modalObserver = new MutationObserver(updateModalScrollLock);
const tabs = $("tabs"), list = $("list");
const overlay = $("overlay"), tagInput = $("tagInput");
const statusInput = $("statusInput"), manualTaskInput = $("manualTaskInput"), modalTitle = $("modalTitle"), deleteBtn = $("deleteBtn");






































document.querySelectorAll(".overlay").forEach(el=>modalObserver.observe(el,{attributes:true,attributeFilter:["class"]}));

document.addEventListener("focusin",e=>{
  const target=e.target;
  if(!target?.matches?.("input,textarea,select"))return;
  if(!target.closest(".sheet"))return;
  setTimeout(()=>{
    try{target.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});}catch(_){}
  },120);
});

document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushSave();});
window.addEventListener("pagehide",flushSave);









// Один набор обработчиков вместо обработчика на каждом теге. Это заметно снижает
// количество объектов/замыканий на длинных списках и уменьшает нагрузку на iPhone/Android.
tabs.addEventListener("click",e=>{
  const b=e.target.closest(".tab");
  if(!b)return;
  filter=b.dataset.filter||"all";
  renderTabs();renderSummary();renderList();
});










list.addEventListener("click",e=>{
  const ref=rowItemFromTarget(e.target);
  if(!ref)return;
  const {row,item}=ref;

  const editBtn=e.target.closest(".rowEdit");
  if(editBtn){
    e.stopPropagation();
    openEdit(item.id);
    return;
  }
  const cancelBtn=e.target.closest(".rowCancel");
  if(cancelBtn){
    e.stopPropagation();
    setSelectionMode(false);
    return;
  }
  const selectBtn=e.target.closest(".rowSelect");
  if(selectBtn){
    e.stopPropagation();
    toggleTagSelection(item.id);
    return;
  }
  const copyBtn=e.target.closest(".rowCopy");
  if(copyBtn){
    e.stopPropagation();
    const ids=selectedTagIds.size?[...selectedTagIds]:[item.id];
    copyTags(ids);
    return;
  }
  if(e.target.closest(".check")){
    e.stopPropagation();
    item.done=!item.done;
    save();
    updateRenderedRowState(row,item);
    renderTabs();renderSummary();
    if(filter==="done"||filter==="todo")renderList();
    return;
  }
  if(selectionMode && !e.target.closest("button,textarea,input,select")){
    e.stopPropagation();
    toggleTagSelection(item.id);
    return;
  }
  const taskToggle=e.target.closest(".taskToggle");
  if(taskToggle){
    e.stopPropagation();
    setTaskEditor(row,item,!row.querySelector(".taskEditorWrap")?.classList.contains("open"),true);
    return;
  }
  const taskSave=e.target.closest(".taskSave");
  if(taskSave){
    e.stopPropagation();
    const ta=row.querySelector(".taskBox textarea");
    item.task=String(ta?.value||"").trim();
    save();
    const toggle=row.querySelector(".taskToggle");
    toggle?.classList.toggle("hasTask",!!item.task);
    setTaskEditor(row,item,false);
    renderTabs();
    return;
  }
  if(longPressTriggered){e.preventDefault();longPressTriggered=false;}
});
list.addEventListener("contextmenu",e=>{
  // На Android долгий тап может породить contextmenu. Он никогда не открывает
  // редактирование: редактирование доступно только через карандаш.
  if(e.target.closest(".row")){
    e.preventDefault();
    e.stopPropagation();
    longPressTriggered=false;
  }
});
list.addEventListener("touchstart",e=>{
  if(e.target.closest("textarea,input,select,button"))return;
  const ref=rowItemFromTarget(e.target);
  if(ref)startLongPress(ref.item.id);
},{passive:true});
list.addEventListener("touchmove",e=>{if(e.target.closest(".row"))cancelLongPress();},{passive:true});
list.addEventListener("touchend",cancelLongPress,{passive:true});
list.addEventListener("touchcancel",cancelLongPress,{passive:true});

















let pullGuardStartY=0;
document.addEventListener("touchstart",e=>{
  if(e.touches?.length!==1)return;
  pullGuardStartY=e.touches[0].clientY;
},{passive:true});
document.addEventListener("touchmove",e=>{
  if(e.touches?.length!==1)return;
  const dy=e.touches[0].clientY-pullGuardStartY;
  if(window.scrollY<=0 && dy>8 && !e.target.closest(".pageStrip,.tabs,.importList,.taskBox textarea,.fullReportText,.fullReportSheet,.sheet")){
    e.preventDefault();
  }
},{passive:false});



























let addMode="manual";
let ocrCandidates=[];
let ocrCandidateMeta=new Map();
let ocrRunToken=0;








































let fileCandidates=[];
let sheetJsPromise=null;










const FONT_OPTIONS=[
  {id:"system",name:"Системный",family:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',sample:"Aa КИП 123"},
  {id:"arial",name:"Arial",family:'Arial,"Helvetica Neue",sans-serif',sample:"Aa КИП 123"},
  {id:"verdana",name:"Verdana",family:'Verdana,sans-serif',sample:"Aa КИП 123"},
  {id:"georgia",name:"Georgia",family:'Georgia,"Times New Roman",serif',sample:"Aa КИП 123"},
  {id:"trebuchet",name:"Trebuchet MS",family:'"Trebuchet MS",Arial,sans-serif',sample:"Aa КИП 123"},
  {id:"courier",name:"Courier New",family:'"Courier New",monospace',sample:"Aa КИП 123"}
];






document.querySelectorAll("[data-dry-kind]").forEach(btn=>btn.addEventListener("click",()=>openDryReport(btn.dataset.dryKind)));
$("dryListClose").onclick=()=>$("dryListOverlay").classList.remove("show");
$("dryListOverlay").addEventListener("click",e=>{if(e.target===$("dryListOverlay"))$("dryListOverlay").classList.remove("show")});
$("fullReportClose").onclick=closeDryReport;
$("fullReportOverlay").addEventListener("click",e=>{if(e.target===$("fullReportOverlay"))closeDryReport();});

let confirmResolver=null;


$("confirmOk").onclick=()=>finishConfirm(true);
$("confirmCancel").onclick=()=>finishConfirm(false);
$("confirmClose").onclick=()=>finishConfirm(false);
$("confirmOverlay").addEventListener("click",e=>{if(e.target===$("confirmOverlay"))finishConfirm(false)});

const THEME_ORDER=["light","navy","violet","green"];
const THEME_ICON={light:"☼",navy:"☾",violet:"◈",green:"◒"};


$("docTitle").addEventListener("blur",()=>{
  if($("docTitle").getAttribute("contenteditable")==="true"){
    $("docTitle").setAttribute("contenteditable","false");
    $("docTitle").classList.remove("editing");
    saveDocumentTitle();
  }
});
$("docTitle").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}
});

document.addEventListener("input",event=>{
  if(event.target.matches(".taskBox textarea")){
    const row=event.target.closest(".row"),id=Number(row?.dataset.id),item=data.find(x=>x.id===id);
    if(item){item.task=event.target.value;scheduleSave();autosizeTaskTextarea(event.target,170);}
  }
});

document.addEventListener("focusin",event=>{
  if(event.target.matches(".taskBox textarea")){
    const editor=event.target.closest(".taskEditorWrap");
    editor?.classList.add("focused");
    autosizeTaskTextarea(event.target,170);
    event.target.scrollTop=0;
  }
});
document.addEventListener("focusout",event=>{
  if(event.target.matches(".taskBox textarea")){
    const editor=event.target.closest(".taskEditorWrap");
    editor?.classList.remove("focused");
    autosizeTaskTextarea(event.target,125);
  }
});

let searchRenderFrame=0;
$("search").addEventListener("input",e=>{
  query=e.target.value;
  renderSummary();
  if(searchRenderFrame)cancelAnimationFrame(searchRenderFrame);
  searchRenderFrame=requestAnimationFrame(()=>{searchRenderFrame=0;renderList();});
});
$("searchBtn").onclick=()=>{$("searchPanel").classList.add("show");setTimeout(()=>$("search").focus(),20);};
$("searchClose").onclick=()=>{query="";$("search").value="";$("searchPanel").classList.remove("show");renderSummary();renderList();};
$("fontMinus").onclick=()=>{
  let s=parseFloat(document.documentElement.style.getPropertyValue("--fontScale"))||1;
  s=Math.max(.65,Math.round((s-.1)*10)/10);document.documentElement.style.setProperty("--fontScale",s);safeSetStorage(FONT_KEY,s);
};
$("fontPlus").onclick=()=>{
  let s=parseFloat(document.documentElement.style.getPropertyValue("--fontScale"))||1;
  s=Math.min(1.35,Math.round((s+.1)*10)/10);document.documentElement.style.setProperty("--fontScale",s);safeSetStorage(FONT_KEY,s);
};
$("addBtn").onclick=openAdd;
$("newDocExportBtn").onclick=openBlankNewDocument;
$("exportAction").onclick=openExportMenu;
$("dryListBtn").onclick=()=>$("dryListOverlay").classList.add("show");
$("exportCloseBtn").onclick=closeExportMenu;
$("exportFileBtn").onclick=handleExportFile;
$("exportAllBtn").onclick=()=>shareTextReport("all");
$("exportDoneBtn").onclick=()=>shareTextReport("done");
$("exportTodoBtn").onclick=()=>shareTextReport("todo");
$("exportTaskBtn").onclick=()=>shareTextReport("task");
$("exportOverlay").addEventListener("click",e=>{if(e.target===$("exportOverlay"))closeExportMenu();});
$("themeBtn").onclick=cycleTheme;
$("fontBtn").onclick=cycleFont;
$("addPageBtn").onclick=createPage;
$("pageManageEdit").onclick=()=>{
  if(selectedPageIds.size!==1){showToast("Выбери одну страницу");return;}
  editSelectedPage();
};
$("pageManageSelect").onclick=()=>selectAllPages();
$("pageManageDelete").onclick=()=>{if(selectedPageIds.size)deleteSelectedPages();};
$("pageManageClose").onclick=exitPageManage;
document.addEventListener("pointerdown",e=>{
  const menu=$("pageContextMenu");
  if(menu?.classList.contains("show")&&!menu.contains(e.target)&&!e.target.closest(".pageChip"))closePageContextMenu();
});
document.addEventListener("scroll",closePageContextMenu,{passive:true});
$("closeBtn").onclick=closeModal;

$("cameraChoice").onclick=()=>{setAddMode("camera"); setTimeout(()=>$("cameraInput").click(),50);};
$("photoChoice").onclick=()=>{setAddMode("photo"); setTimeout(()=>$("photoInput").click(),50);};
$("fileChoice").onclick=()=>setAddMode("file");

$("ocrBackBtn").onclick=()=>{
  $("importList").innerHTML=""; $("importActions").style.display="none"; ocrCandidateMeta=new Map();
  $("ocrStatus").textContent=""; $("ocrProgressWrap").style.display="none";
  setAddMode("manual");
};
$("fileSelectBtn").onclick=()=>$("importFileInput").click();
$("filePasteBtn").onclick=pasteTextImport;
$("fileBackBtn").onclick=()=>{
  $("fileImportList").innerHTML="";$("fileImportActions").style.display="none";$("fileImportStatus").textContent="";
  $("fileProgressWrap").style.display="none";setFileProgress(0);
  setAddMode("manual");
};
updateOcrConfigStatus();
$("cameraInput").addEventListener("change",async e=>{
  const file=e.target.files && e.target.files[0]; e.target.value="";
  if(!file)return;
  try{await ensureOcrLoaded(); runOCR(file);}catch(err){showToast(err.message||"Не удалось загрузить OCR");}
});
$("photoInput").addEventListener("change",async e=>{
  const file=e.target.files && e.target.files[0]; e.target.value="";
  if(!file)return;
  try{await ensureOcrLoaded(); runOCR(file);}catch(err){showToast(err.message||"Не удалось загрузить OCR");}
});
$("importFileInput").addEventListener("change",event=>{
  const file=event.target.files&&event.target.files[0];if(file)runFileImport(file);event.target.value="";
});
$("importBtn").onclick=async()=>{try{await ensureOcrLoaded();importCandidates();}catch(err){showToast(err.message||"Не удалось загрузить OCR");}};
$("cancelImportBtn").onclick=()=>setAddMode("manual");
$("fileImportBtn").onclick=importFileCandidates;
$("cancelFileImportBtn").onclick=()=>setAddMode("manual");
$("duplicateEditBtn").onclick=()=>{
  const pending=pendingDuplicate?.pending;closeDuplicateDialog();
  if(pending){tagInput.value=pending.tag;manualTaskInput.value=pending.task||"";statusInput.value=pending.done?"done":"todo";setAddMode("manual");setTimeout(()=>tagInput.focus(),50);}
};
$("duplicateDeleteBtn").onclick=()=>{
  if(!pendingDuplicate)return;
  const pending=pendingDuplicate.pending,duplicateId=pendingDuplicate.duplicateId;
  data=data.filter(item=>item.id!==duplicateId);save();closeDuplicateDialog();
  editId=pending.editId;tagInput.value=pending.tag;manualTaskInput.value=pending.task||"";statusInput.value=pending.done?"done":"todo";
  if(editId!==null){
    const item=data.find(x=>x.id===editId);
    if(item){item.unit=pending.unit;item.tag=pending.tag;item.done=pending.done;item.task=pending.task||"";save();closeModal();render();showToast("Дубликат удалён, запись обновлена");return;}
  }
  const max=data.reduce((m,x)=>Math.max(m,Number(x.id)||0),0);data.push({id:max+1,unit:pending.unit,tag:pending.tag,done:pending.done,task:pending.task||""});save();closeModal();render();showToast("Дубликат удалён, новый прибор добавлен");
};
$("duplicateCloseBtn").onclick=closeDuplicateDialog;
$("duplicateOverlay").addEventListener("click",e=>{if(e.target===$("duplicateOverlay"))closeDuplicateDialog();});

$("saveBtn").onclick=saveModal;
deleteBtn.onclick=deleteCurrent;
overlay.addEventListener("click",e=>{if(e.target===overlay)closeModal();});
$("deleteAll").onclick=()=>{
  if(selectionMode){
    const ids=[...selectedTagIds];
    if(!ids.length){showToast("Выбери теги для удаления");return;}
    const set=new Set(ids);
    data=data.filter(item=>!set.has(item.id));
    selectedTagIds.clear();
    selectionMode=false;
    document.body.classList.remove("selection-mode-active");
    save();
    filter="all";
    updateSelectionFooter();
    render();
    showToast(`Удалено тегов: ${ids.length}`);
    return;
  }
  const count=data.length;
  if(!count){showToast("Список уже пуст");return;}
  data=[];
  save();
  filter="all";
  render();
  showToast(`Удалено тегов: ${count}`);
};
$("markAllDone").onclick=()=>{
  if(selectionMode){
    const total=data.length;
    if(!total){showToast("На странице нет тегов");return;}
    selectedTagIds=new Set(data.map(item=>item.id));
    updateSelectionFooter();
    renderList();
    showToast(`Выбраны все теги: ${total}`);
    return;
  }

  const todo=data.filter(item=>!item.done).length;
  if(!todo){showToast("Все теги уже отмечены");return;}
  data.forEach(item=>item.done=true);
  save();
  filter="all";
  render();
  showToast(`Отмечены как выполненные: ${todo}`);
};

$("clearChecks").onclick=()=>{
  // В режиме выборки кнопка снимает весь выбор, не меняя статусы тегов.
  if(selectionMode){
    if(!selectedTagIds.size){showToast("Выбор уже пуст");return;}
    selectedTagIds.clear();
    selectionMode=false;
    document.body.classList.remove("selection-mode-active");
    updateSelectionFooter();
    renderList();
    showToast("Выбор снят со всех тегов");
    return;
  }

  const marked=data.filter(item=>item.done).length;
  if(!marked){showToast("Отметок для сброса нет");return;}
  data.forEach(item=>item.done=false);
  save();
  filter="all";
  render();
  showToast(`Сняты отметки: ${marked}`);
};
document.addEventListener("selectstart",e=>{
  if(e.target.closest("input,textarea,select,[contenteditable=true]")) return;
  if(e.target.closest("button,.pageChip,.tab,.row,.utilityRow,.footer,.fab,.searchClose")) e.preventDefault();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeDuplicateDialog();if(selectionMode){setSelectionMode(false);}$("dryListOverlay").classList.remove("show");closeDryReport();if(confirmResolver)finishConfirm(false);}});

// Enter в поле тега сохраняет запись и закрывает клавиатуру;
// в многострочном задании сохранение выполняется по Ctrl/Cmd+Enter.
tagInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();tagInput.blur();saveModal();}});
manualTaskInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();manualTaskInput.blur();saveModal();}});


// v58: браузеры Android иногда оставляют старые размеры viewport после поворота.
// Даём движку один кадр на перерасчёт, не меняя данные и не трогая активное поле ввода.
let viewportRefreshTimer=0;

window.addEventListener("orientationchange",()=>requestAnimationFrame(refreshAfterViewportChange),{passive:true});
window.addEventListener("resize",()=>{ if(Math.abs((window.innerWidth||0)-((window.visualViewport&&window.visualViewport.width)||window.innerWidth))>2) return; refreshAfterViewportChange(); },{passive:true});
if(window.visualViewport) window.visualViewport.addEventListener("resize",refreshAfterViewportChange,{passive:true});

// OCR is loaded only when the user opens the camera/photo OCR path.
let ocrLoadPromise=null;
function ensureOcrLoaded(){
  if(window.runOCR && window.importCandidates) return Promise.resolve();
  if(ocrLoadPromise) return ocrLoadPromise;
  ocrLoadPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    const src=new URL("./js/ocr.js",document.baseURI).href;
    let settled=false;
    const done=()=>{if(settled)return;settled=true;resolve();};
    const fail=()=>{
      if(settled)return;
      settled=true;
      script.remove();
      reject(new Error("Не удалось загрузить OCR-модуль. Проверьте, что файл js/ocr.js опубликован на GitHub Pages."));
    };
    script.async=true;
    script.src=src;
    script.onload=done;
    script.onerror=fail;
    document.head.appendChild(script);
  }).catch(err=>{ocrLoadPromise=null;throw err;});
  return ocrLoadPromise;
}

// PWA installation.
// Chromium-based browsers can provide the native install prompt via beforeinstallprompt.
// iOS does not expose that event: the button gives the native Safari/Chrome installation path.
let deferredInstallPrompt=null;
const installAppBtn=$("installApp");





if(installAppBtn && isStandaloneApp()){
  hideInstallButton();
}

window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  if(installAppBtn && !isStandaloneApp()) installAppBtn.hidden=false;
});

if(installAppBtn){
  installAppBtn.onclick=async()=>{
    if(isStandaloneApp()){
      hideInstallButton();
      return;
    }
    if(!deferredInstallPrompt){
      showInstallFallback();
      return;
    }

    const promptEvent=deferredInstallPrompt;
    deferredInstallPrompt=null;
    try{
      const choice=await promptEvent.prompt();
      if(choice?.outcome==="accepted"){
        installAppBtn.hidden=true;
      }
      await promptEvent.userChoice.catch(()=>null);
    }catch(_){
      // Не меняем остальной интерфейс приложения при сбое системного prompt.
    }
  };
}

window.addEventListener("appinstalled",hideInstallButton);


const savedFont=parseFloat(safeGetStorage(FONT_KEY,null));
if(savedFont) document.documentElement.style.setProperty("--fontScale",savedFont);
const savedFontFamily=safeGetStorage(FONT_FAMILY_KEY,"system")||"system";
applyFontFamily(savedFontFamily);
applyTheme(safeGetStorage(THEME_KEY,"navy")||"navy");
applyDocumentTitle();
render();

