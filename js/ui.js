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

function closeDryReport(){$("fullReportOverlay").classList.remove("show");}

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
