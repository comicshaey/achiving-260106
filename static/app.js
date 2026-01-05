/* 기록 아카이브 (정적 + 로컬저장소)
   - 서버 없이 브라우저에 기록 저장
   - 이미지도 base64로 저장(용량 주의)
*/

const STORAGE_KEY = "haey_archive_v1";

const $ = (sel) => document.querySelector(sel);

const elCards = $("#cards");
const elEmpty = $("#empty");
const elSummary = $("#summary");

const elQ = $("#q");
const elCategory = $("#category");
const elSort = $("#sort");

const modal = $("#modal");
const form = $("#form");

const btnNew = $("#btnNew");
const btnClose = $("#btnClose");
const btnCancel = $("#btnCancel");
const btnDelete = $("#btnDelete");
const btnExport = $("#btnExport");
const btnClearAll = $("#btnClearAll");

const importFile = $("#importFile");

const fEditingId = $("#editingId");
const fTitle = $("#title");
const fDate = $("#date");
const fType = $("#type");
const fTags = $("#tags");
const fContent = $("#content");
const fImages = $("#images");
const elPreview = $("#preview");
const elModalTitle = $("#modalTitle");

let cache = loadAll(); // 전체 데이터
let tempImages = [];   // 모달에서 선택한 이미지(저장 전)

init();

function init(){
  // 기본 날짜: 오늘
  fDate.value = toDateInputValue(new Date());

  btnNew.addEventListener("click", () => openNew());
  btnClose.addEventListener("click", () => modal.close());
  btnCancel.addEventListener("click", () => modal.close());

  elQ.addEventListener("input", render);
  elCategory.addEventListener("change", render);
  elSort.addEventListener("change", render);

  fImages.addEventListener("change", handleImagePick);

  form.addEventListener("submit", onSubmit);

  btnDelete.addEventListener("click", () => {
    const id = fEditingId.value;
    if(!id) return;
    const ok = confirm("이 기록을 삭제할까요?");
    if(!ok) return;
    cache = cache.filter(x => x.id !== id);
    saveAll(cache);
    modal.close();
    render();
  });

  btnExport.addEventListener("click", exportJSON);

  importFile.addEventListener("change", importJSON);

  btnClearAll.addEventListener("click", () => {
    const ok = confirm("전체 기록을 삭제할까요? (되돌리기 어려움)");
    if(!ok) return;
    cache = [];
    saveAll(cache);
    render();
  });

  render();
}

/* ---------------------------
   데이터 I/O
--------------------------- */

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed;
  }catch(e){
    console.warn("로드 실패:", e);
    return [];
  }
}

function saveAll(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* ---------------------------
   렌더/필터
--------------------------- */

function render(){
  const q = (elQ.value || "").trim().toLowerCase();
  const cat = elCategory.value;
  const sort = elSort.value;

  let items = [...cache];

  // 카테고리 필터
  if(cat !== "all"){
    items = items.filter(x => x.type === cat);
  }

  // 검색(제목/내용/태그)
  if(q){
    items = items.filter(x => {
      const hay = [
        x.title || "",
        x.content || "",
        (x.tags || []).join(","),
      ].join("\n").toLowerCase();
      return hay.includes(q);
    });
  }

  // 정렬
  items.sort((a,b) => {
    const da = new Date(a.date || a.createdAt).getTime();
    const db = new Date(b.date || b.createdAt).getTime();
    return sort === "new" ? (db - da) : (da - db);
  });

  elSummary.textContent = `${items.length}건 / 전체 ${cache.length}건`;

  elCards.innerHTML = "";
  if(items.length === 0){
    elEmpty.classList.remove("hidden");
    return;
  }
  elEmpty.classList.add("hidden");

  for(const item of items){
    elCards.appendChild(cardOf(item));
  }
}

function cardOf(item){
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card__head";

  const badge = document.createElement("div");
  badge.className = `badge ${item.type}`;
  badge.textContent = typeLabel(item.type);

  const metaBox = document.createElement("div");
  metaBox.style.flex = "1";

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = item.title || "(제목없음)";

  const meta = document.createElement("div");
  meta.className = "card__meta";
  meta.textContent = `${formatDate(item.date)} · ${formatTime(item.createdAt)}`;

  metaBox.appendChild(title);
  metaBox.appendChild(meta);

  head.appendChild(badge);
  head.appendChild(metaBox);

  const tags = document.createElement("div");
  tags.className = "tags";
  (item.tags || []).forEach(t => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = `#${t}`;
    tags.appendChild(span);
  });

  const content = document.createElement("div");
  content.className = "card__content";
  content.textContent = item.content || "";

  const thumbrow = document.createElement("div");
  thumbrow.className = "thumbrow";
  (item.images || []).slice(0, 8).forEach(src => {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = src;
    img.alt = "image";
    img.loading = "lazy";
    img.addEventListener("click", () => openImage(src));
    thumbrow.appendChild(img);
  });

  const foot = document.createElement("div");
  foot.className = "card__foot";

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn";
  btnEdit.type = "button";
  btnEdit.textContent = "열기/수정";
  btnEdit.addEventListener("click", () => openEdit(item.id));

  const btnCopy = document.createElement("button");
  btnCopy.className = "btn";
  btnCopy.type = "button";
  btnCopy.textContent = "내용복사";
  btnCopy.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(item.content || "");
      alert("복사 완료");
    }catch(e){
      alert("복사 실패(브라우저 권한 확인)");
    }
  });

  foot.appendChild(btnCopy);
  foot.appendChild(btnEdit);

  card.appendChild(head);
  if((item.tags || []).length) card.appendChild(tags);
  if(item.content) card.appendChild(content);
  if((item.images || []).length) card.appendChild(thumbrow);
  card.appendChild(foot);

  return card;
}

/* ---------------------------
   모달: 생성/수정
--------------------------- */

function openNew(){
  elModalTitle.textContent = "새 기록";
  fEditingId.value = "";
  fTitle.value = "";
  fDate.value = toDateInputValue(new Date());
  fType.value = "creative";
  fTags.value = "";
  fContent.value = "";
  fImages.value = "";
  tempImages = [];
  elPreview.innerHTML = "";
  btnDelete.classList.add("hidden");

  modal.showModal();
}

function openEdit(id){
  const item = cache.find(x => x.id === id);
  if(!item) return;

  elModalTitle.textContent = "기록 수정";
  fEditingId.value = item.id;
  fTitle.value = item.title || "";
  fDate.value = item.date ? item.date : toDateInputValue(new Date(item.createdAt));
  fType.value = item.type || "etc";
  fTags.value = (item.tags || []).join(", ");
  fContent.value = item.content || "";

  // 기존 이미지 유지: tempImages에 기존 + 새 선택분 합칠 수 있게
  tempImages = [...(item.images || [])];
  elPreview.innerHTML = "";
  renderPreview(tempImages);

  fImages.value = "";
  btnDelete.classList.remove("hidden");

  modal.showModal();
}

async function onSubmit(e){
  e.preventDefault();

  const title = (fTitle.value || "").trim();
  const date = fDate.value || "";
  const type = fType.value;
  const tags = normalizeTags(fTags.value);
  const content = (fContent.value || "").trim();

  if(!title){
    alert("제목은 필수입니다.");
    return;
  }

  const nowIso = new Date().toISOString();
  const editingId = fEditingId.value;

  if(editingId){
    // 수정
    cache = cache.map(x => {
      if(x.id !== editingId) return x;
      return {
        ...x,
        title, date, type, tags, content,
        images: [...tempImages],
        updatedAt: nowIso,
      };
    });
  }else{
    // 신규
    const item = {
      id: cryptoId(),
      title,
      date,
      type,
      tags,
      content,
      images: [...tempImages],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    cache.unshift(item);
  }

  saveAll(cache);
  modal.close();
  render();
}

/* ---------------------------
   이미지 처리
--------------------------- */

async function handleImagePick(){
  const files = Array.from(fImages.files || []);
  if(files.length === 0) return;

  // 파일을 base64(dataURL)로 변환해서 tempImages에 누적
  for(const file of files){
    try{
      const dataUrl = await fileToDataURL(file);

      // 너무 큰 파일이면 저장공간 터질 수 있어서 미리 경고 정도는 해줌
      if(dataUrl.length > 3_500_000){
        const ok = confirm(
          "이미지가 큰 편입니다(저장공간 한계로 실패할 수 있음). 그래도 추가할까요?"
        );
        if(!ok) continue;
      }

      tempImages.push(dataUrl);
    }catch(e){
      console.warn("이미지 변환 실패:", e);
      alert("이미지 처리 중 오류가 발생했습니다.");
    }
  }

  renderPreview(tempImages);
  fImages.value = "";
}

function renderPreview(list){
  elPreview.innerHTML = "";
  list.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";

    const img = document.createElement("img");
    img.className = "preview__img";
    img.src = src;
    img.alt = "preview";
    img.loading = "lazy";
    img.title = "클릭하면 크게 보기";
    img.addEventListener("click", () => openImage(src));

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✕";
    del.style.position = "absolute";
    del.style.right = "6px";
    del.style.top = "6px";
    del.style.border = "1px solid rgba(0,0,0,.15)";
    del.style.background = "rgba(255,255,255,.95)";
    del.style.borderRadius = "10px";
    del.style.cursor = "pointer";
    del.style.padding = "2px 8px";
    del.addEventListener("click", () => {
      tempImages.splice(idx, 1);
      renderPreview(tempImages);
    });

    wrap.appendChild(img);
    wrap.appendChild(del);
    elPreview.appendChild(wrap);
  });
}

function openImage(src){
  const w = window.open("", "_blank");
  if(!w) return;
  w.document.write(`
    <title>이미지 보기</title>
    <style>
      body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;}
      img{max-width:100vw;max-height:100vh;object-fit:contain;}
    </style>
    <img src="${src}" />
  `);
  w.document.close();
}

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/* ---------------------------
   내보내기/가져오기
--------------------------- */

function exportJSON(){
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    items: cache,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `archive-export-${toDateStamp(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function importJSON(){
  const file = importFile.files?.[0];
  if(!file) return;

  try{
    const text = await file.text();
    const data = JSON.parse(text);

    // 1) {items:[...]} 형태
    // 2) 그냥 배열 형태([...]) 둘 다 허용
    let items = [];
    if(Array.isArray(data)) items = data;
    else if(Array.isArray(data.items)) items = data.items;

    if(!Array.isArray(items)) throw new Error("형식이 올바르지 않음");

    // 최소한의 정리
    items = items.map(x => ({
      id: x.id || cryptoId(),
      title: x.title || "(제목없음)",
      date: x.date || "",
      type: x.type || "etc",
      tags: Array.isArray(x.tags) ? x.tags : [],
      content: x.content || "",
      images: Array.isArray(x.images) ? x.images : [],
      createdAt: x.createdAt || new Date().toISOString(),
      updatedAt: x.updatedAt || new Date().toISOString(),
    }));

    const ok = confirm(`가져온 ${items.length}건을 현재 아카이브에 합칠까요?`);
    if(!ok) return;

    // id 충돌 회피: 충돌이면 새 id 발급
    const existingIds = new Set(cache.map(x => x.id));
    const merged = [...cache];

    for(const it of items){
      if(existingIds.has(it.id)){
        it.id = cryptoId();
      }
      merged.push(it);
    }

    cache = merged;
    saveAll(cache);
    render();
    alert("가져오기 완료");
  }catch(e){
    console.warn(e);
    alert("가져오기 실패: JSON 형식 확인 필요");
  }finally{
    importFile.value = "";
  }
}

/* ---------------------------
   유틸
--------------------------- */

function normalizeTags(raw){
  return (raw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^#/, ""))
    .slice(0, 30); // 태그 폭주 방지
}

function typeLabel(type){
  if(type === "creative") return "창작";
  if(type === "work") return "업무";
  if(type === "daily") return "일상";
  return "기타";
}

function cryptoId(){
  // 깔끔하게 가자: 시간 + 랜덤
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function formatDate(dateStr){
  if(!dateStr) return "날짜 미지정";
  return dateStr;
}

function formatTime(iso){
  try{
    const d = new Date(iso);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mi = String(d.getMinutes()).padStart(2,"0");
    return `${yy}.${mm}.${dd} ${hh}:${mi}`;
  }catch{
    return "";
  }
}

function toDateInputValue(d){
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}

function toDateStamp(d){
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}${mm}${dd}`;
}
