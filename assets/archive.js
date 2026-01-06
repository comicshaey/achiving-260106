// ✅ 기록관: 공용 JSON(전 기기 동일) + 임시편집(draft)
// - 공용 원본: /data/archive-records.json (GitHub에서 직접 수정/커밋)
// - 정적 호스팅이라 브라우저에서 공용 JSON 자동 저장은 불가
//   => 화면에서 편집은 draft로 저장 -> 병합 JSON 내보내기 -> GitHub JSON 교체 커밋

const DATA_URL = "./data/archive-records.json";
const DRAFT_KEY = "haey_archive_records_draft_v1";

function cacheBusted(url){
  return `${url}?v=${Date.now()}`;
}

async function loadShared(){
  const res = await fetch(cacheBusted(DATA_URL), { cache: "no-store" });
  if(!res.ok) throw new Error(`기록 JSON 로드 실패: ${res.status}`);
  const data = await res.json();
  if(!Array.isArray(data)) throw new Error("기록 JSON 형식 오류: 배열이 아님");

  return data.map(x => ({
    id: String(x.id || HAEY.store.uid()),
    date: x.date || "",
    title: x.title || "",
    tags: Array.isArray(x.tags) ? x.tags : [],
    body: x.body || "",
    createdAt: x.createdAt || Date.now(),
    updatedAt: x.updatedAt || Date.now()
  }));
}

function loadDraft(){
  const data = HAEY.store.get(DRAFT_KEY, []);
  return Array.isArray(data) ? data : [];
}
function saveDraft(arr){
  HAEY.store.set(DRAFT_KEY, arr);
}
function clearDraft(){
  HAEY.store.set(DRAFT_KEY, []);
}

function mergeSharedAndDraft(shared, draft){
  const m = new Map();
  shared.forEach(r => m.set(r.id, r));
  draft.forEach(r => m.set(r.id, r)); // draft 우선
  return [...m.values()];
}

function normalizeRecord(input){
  const tags = Array.isArray(input.tags) ? input.tags : [];
  return {
    id: String(input.id || HAEY.store.uid()),
    date: input.date || "",
    title: input.title || "",
    tags: tags.map(t=>String(t)).filter(Boolean),
    body: input.body || "",
    createdAt: input.createdAt || Date.now(),
    updatedAt: input.updatedAt || Date.now()
  };
}

function getCurrentSource(shared, draft){
  const mode = document.getElementById("viewMode")?.value || "merged";
  if(mode === "shared") return shared;
  if(mode === "draft") return draft;
  return mergeSharedAndDraft(shared, draft);
}

function buildTagCount(records){
  const tagCount = new Map();
  records.forEach(r=>{
    (r.tags||[]).forEach(t=>{
      tagCount.set(t, (tagCount.get(t)||0)+1);
    });
  });
  return tagCount;
}

function render(shared, draft){
  const listEl = document.getElementById("recordList");
  const tagCloudEl = document.getElementById("tagCloud");

  const tagFilter = (document.getElementById("tagFilter").value || "").trim();
  const sortMode = document.getElementById("sortMode").value;
  const source = getCurrentSource(shared, draft);

  // 태그 클라우드: 현재 뷰 기준으로 생성
  const tagCount = buildTagCount(source);
  tagCloudEl.innerHTML = "";
  const tagsSorted = [...tagCount.entries()].sort((a,b)=>b[1]-a[1]);

  tagsSorted.forEach(([tag, cnt])=>{
    const btn = document.createElement("button");
    btn.className = "tag" + (tagFilter === tag ? " is-active" : "");
    btn.type = "button";
    btn.textContent = `${tag} (${cnt})`;
    btn.addEventListener("click", ()=>{
      document.getElementById("tagFilter").value = (tagFilter === tag) ? "" : tag;
      render(shared, draft);
    });
    tagCloudEl.appendChild(btn);
  });

  // 필터/정렬
  let filtered = source.slice();
  if(tagFilter){
    filtered = filtered.filter(r => (r.tags||[]).includes(tagFilter));
  }
  filtered.sort((a,b)=>{
    const da = a.date || "";
    const db = b.date || "";
    return sortMode === "asc" ? da.localeCompare(db) : db.localeCompare(da);
  });

  listEl.innerHTML = "";
  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "표시할 기록이 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach(r=>{
    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.className = "item__top";

    const title = document.createElement("div");
    title.className = "item__title";
    title.textContent = r.title || "(제목 없음)";

    const date = document.createElement("div");
    date.className = "item__date";
    date.textContent = r.date || "";

    top.appendChild(title);
    top.appendChild(date);

    const tags = document.createElement("div");
    tags.className = "item__tags";
    (r.tags||[]).forEach(t=>{
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      span.addEventListener("click", ()=>{
        document.getElementById("tagFilter").value = t;
        render(shared, draft);
      });
      tags.appendChild(span);
    });

    const body = document.createElement("div");
    body.className = "item__body";
    body.textContent = r.body || "";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "10px";
    actions.style.flexWrap = "wrap";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.type = "button";
    btnEdit.textContent = "임시 수정";
    btnEdit.addEventListener("click", ()=>{
      // 폼에 주입
      document.getElementById("recDate").value = r.date || "";
      document.getElementById("recTitle").value = r.title || "";
      document.getElementById("recTags").value = (r.tags||[]).join(",");
      document.getElementById("recBody").value = r.body || "";

      const form = document.getElementById("recordForm");
      form.dataset.editId = r.id;

      window.scrollTo({top:0, behavior:"smooth"});
    });

    const btnDel = document.createElement("button");
    btnDel.className = "btn btn--danger";
    btnDel.type = "button";
    btnDel.textContent = "임시 삭제";
    btnDel.addEventListener("click", ()=>{
      if(!confirm("해당 기록을 '임시편집(draft)'에서 삭제할까요?\n(공용 JSON 원본은 변경되지 않습니다)")) return;

      // draft에서 해당 id 제거
      const nextDraft = loadDraft().filter(x=>x.id !== r.id);
      saveDraft(nextDraft);

      render(shared, nextDraft);
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);

    item.appendChild(top);
    item.appendChild(tags);
    item.appendChild(body);
    item.appendChild(actions);

    listEl.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const form = document.getElementById("recordForm");
  const btnCancel = document.getElementById("btnCancelEdit");

  let shared = [];
  let draft = loadDraft();

  async function refreshShared(){
    try{
      shared = await loadShared();
      render(shared, draft);
      alert("공용 JSON 새로고침 완료");
    }catch(err){
      console.error(err);
      alert("공용 JSON을 불러오지 못했습니다. /data/archive-records.json 경로와 JSON 형식을 확인하세요.");
      shared = [];
      render(shared, draft);
    }
  }

  // 최초 로드
  try{
    shared = await loadShared();
  }catch(err){
    console.error(err);
    shared = [];
  }
  render(shared, draft);

  // 입력 변경 시 렌더
  document.getElementById("tagFilter").addEventListener("input", ()=>render(shared, draft));
  document.getElementById("sortMode").addEventListener("change", ()=>render(shared, draft));
  document.getElementById("viewMode").addEventListener("change", ()=>render(shared, draft));

  // 공용 새로고침
  document.getElementById("btnReloadShared").addEventListener("click", refreshShared);

  // 수정 취소
  btnCancel.addEventListener("click", ()=>{
    form.reset();
    delete form.dataset.editId;
    // 날짜는 common.js가 자동 세팅
  });

  // 폼 저장: draft에 저장
  form.addEventListener("submit", (e)=>{
    e.preventDefault();

    const date = document.getElementById("recDate").value;
    const title = document.getElementById("recTitle").value.trim();
    const tags = HAEY.store.toTagArray(document.getElementById("recTags").value);
    const body = document.getElementById("recBody").value;

    const editId = form.dataset.editId || "";
    const now = Date.now();

    const currentDraft = loadDraft();

    if(editId){
      // draft에서 수정(없으면 추가)
      const idx = currentDraft.findIndex(r=>r.id === editId);
      if(idx >= 0){
        currentDraft[idx] = normalizeRecord({ ...currentDraft[idx], date, title, tags, body, updatedAt: now });
      }else{
        // 공용을 수정하는 케이스: 같은 id로 draft에 덮어쓰기
        currentDraft.push(normalizeRecord({ id: editId, date, title, tags, body, createdAt: now, updatedAt: now }));
      }
      delete form.dataset.editId;
    }else{
      currentDraft.push(normalizeRecord({
        id: HAEY.store.uid(),
        date, title, tags, body,
        createdAt: now,
        updatedAt: now
      }));
    }

    saveDraft(currentDraft);
    draft = currentDraft;

    form.reset();
    render(shared, draft);
  });

  // 병합 내보내기: 공용+임시를 합쳐 최종본 JSON 생성
  document.getElementById("btnExportMerged").addEventListener("click", ()=>{
    const merged = mergeSharedAndDraft(shared, loadDraft())
      .sort((a,b)=> (a.date||"").localeCompare(b.date||""));

    HAEY.store.downloadJSON("archive-records.merged.json", merged);
    alert("내보내기 완료.\nGitHub에서 /data/archive-records.json 파일을 열고, 이 JSON 내용으로 교체 후 커밋하면 전 기기 동기화됩니다.");
  });

  // 임시 가져오기: draft로만 저장
  document.getElementById("fileImportDraft").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const data = await HAEY.store.readJSONFile(file);
      if(!Array.isArray(data)) throw new Error("형식 오류: 배열이 아님");

      const imported = data.map(normalizeRecord);
      saveDraft(imported);
      draft = imported;

      render(shared, draft);
      e.target.value = "";
      alert("가져오기 완료(임시편집 데이터로 반영됨)");
    }catch(err){
      console.error(err);
      alert("가져오기 실패: JSON 형식을 확인하세요.");
    }
  });

  // 임시편집 전체 삭제
  document.getElementById("btnClearDraft").addEventListener("click", ()=>{
    if(!confirm("이 기기의 '임시편집(draft)'을 전체 삭제할까요?\n(공용 JSON 원본은 그대로)")) return;
    clearDraft();
    draft = [];
    render(shared, draft);
  });
});