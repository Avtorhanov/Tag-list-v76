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

function formatReportItems(items){
  return items.map((item,index)=>{
    const tag=cleanReportField(item.tag)||"Без тега";
    const task=cleanReportField(item.task);
    return `${index+1}. ${tag}${task?` — ${task}`:""}`;
  }).join("\n");
}

function buildPageTextReport(page,kind="all"){
  if(!page)return "";
  const done=page.data.filter(item=>item.done);
  const todo=page.data.filter(item=>!item.done);
  const tasks=page.data.filter(item=>!!cleanReportField(item.task));

  let body="";
  if(kind==="done"){
    body=`Выполненные\n${done.length?formatReportItems(done):"Нет"}`;
  }else if(kind==="todo"){
    body=`Невыполненные\n${todo.length?formatReportItems(todo):"Нет"}`;
  }else if(kind==="task"){
    body=`Задания\n${tasks.length?formatReportItems(tasks):"Нет"}`;
  }else{
    const sections=[];
    if(done.length)sections.push(`Выполненные\n${formatReportItems(done)}`);
    if(todo.length)sections.push(`Невыполненные\n${formatReportItems(todo)}`);
    if(!sections.length)sections.push("Выполненные\nНет\n\nНевыполненные\nНет");
    body=sections.join("\n\n");
  }
  return `${reportPageHeader(page)}\n\n${body}`;
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
