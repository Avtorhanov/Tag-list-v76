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
