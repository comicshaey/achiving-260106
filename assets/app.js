/* vibe coding: MVP답게 단단한데 너무 무겁지 않게 */

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];

const SCOPE_LABEL = {
  public: "업무(공적)",
  health: "건강관리",
  creative: "창작",
  dev: "개발",
};

function scopeBadge(scope){
  const map = {
    public: "badge badge--public",
    health: "badge badge--health",
    creative: "badge badge--creative",
    dev: "badge badge--dev",
  };
  return map[scope] || "badge";
}

function escapeHtml(s=""){
  return s.replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

/* 초간단 마크다운 렌더러
   - 프로젝트가 커지면 markdown-it 같은 걸로 바꾸면 됨(지금은 무설치로 감) */
function mdToHtml(md=""){
  let s = md.replace(/\r\n/g,"\n");

  // 코드블록 ``` ```
  s = s.replace(/```([\s\S]*?)```/g, (_, code)=>`<pre><code>${escapeHtml(code.trim())}</code></pre>`);

  // 인용 >
  s = s.replace(/^\s*>\s?(.*)$/gm, (_, t)=>`<blockquote>${escapeHtml(t)}</blockquote>`);

  // 헤더
  s = s.replace(/^###\s+(.*)$/gm, (_, t)=>`<h3>${escapeHtml(t)}</h3>`);
  s = s.replace(/^##\s+(.*)$/gm, (_, t)=>`<h2>${escapeHtml(t)}</h2>`);
  s = s.replace(/^#\s+(.*)$/gm, (_, t)=>`<h1>${escapeHtml(t)}</h1>`);

  // 리스트 - , * (아주 간단 버전)
  s = s.replace(/^\s*[-*]\s+(.*)$/gm, (_, t)=>`<li>${escapeHtml(t)}</li>`);
  // 연속된 li를 ul로 감싸기(대충 MVP)
  s = s.replace(/(<li>[\s\S]*?<\/li>)/g, (block)=>{
    // 이미 ul로 감싸진 경우 중복 방지하려고 간단 체크
    return block;
  });
  // li 묶기(연속 li 줄만)
  s = s.replace(/(?:<li>.*<\/li>\n?)+/g, (m)=>`<ul>${m}</ul>`);

  // 인라인 코드 `
  s = s.replace(/`([^`]+)`/g, (_, t)=>`<code>${escapeHtml(t)}</code>`);

  // 볼드 ** **
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, t)=>`<strong>${escapeHtml(t)}</strong>`);

  // 줄바꿈 두 번 = 문단
  const parts = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const html = parts.map(p=>{
    // 이미 블록태그 시작하면 그대로
    if (/^<(h1|h2|h3|ul|pre|blockquote)/.test(p)) return p;
    return `<p>${escapeHtml(p).replace(/\n/g,"<br/>")}</p>`;
  }).join("\n");
  return html;
}

const state = {
  posts: [],
  tagOn: null,
  q: "",
  scope: "all",
  sort: "new",
  theme: localStorage.getItem("theme") || "dark",
};

function setTheme(t){
  state.theme = t;
  localStorage.setItem("theme", t);
  document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
}

async function loadPosts(){
  const res = await fetch("data/posts.json", { cache: "no-store" });
  const json = await res.json();
  state.posts = (json.posts || []).map(p => ({
    ...p,
    dateObj: new Date(p.date + "T00:00:00"),
    tags: p.tags || []
  }));
}

function allTags(){
  const m = new Map();
  for (const p of state.posts){
    for (const t of p.tags) m.set(t, (m.get(t)||0)+1);
  }
  // 많이 쓰는 태그 먼저
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([t])=>t);
}

function renderTags(){
  const host = $("#tagChips");
  host.innerHTML = "";
  const tags = allTags().slice(0, 18); // MVP라 너무 많으면 지저분해짐
  for (const t of tags){
    const b = document.createElement("button");
    b.className = "chip" + (state.tagOn === t ? " is-on" : "");
    b.type = "button";
    b.textContent = `#${t}`;
    b.onclick = () => {
      state.tagOn = (state.tagOn === t) ? null : t;
      reroute(location.hash || "#/");
    };
    host.appendChild(b);
  }
}

function applyFilters(posts){
  let list = posts.slice();

  if (state.scope !== "all"){
    list = list.filter(p => p.scope === state.scope);
  }
  if (state.tagOn){
    list = list.filter(p => p.tags.includes(state.tagOn));
  }
  if (state.q.trim()){
    const q = state.q.trim().toLowerCase();
    list = list.filter(p => {
      const hay = [
        p.title || "",
        p.summary || "",
        (p.tags || []).join(" "),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  if (state.sort === "new"){
    list.sort((a,b)=> b.dateObj - a.dateObj);
  } else if (state.sort === "old"){
    list.sort((a,b)=> a.dateObj - b.dateObj);
  } else if (state.sort === "title"){
    list.sort((a,b)=> (a.title||"").localeCompare(b.title||"", "ko"));
  }

  return list;
}

function fmtDate(d){
  // yyyy-mm-dd 그대로 쓰는 게 행정적으로도 깔끔함
  return d;
}

function viewTitle(t){
  $("#viewTitle").textContent = t;
}

function renderHome(){
  viewTitle("홈");

  const list = applyFilters(state.posts);
  const counts = state.posts.reduce((acc,p)=>{
    acc[p.scope] = (acc[p.scope]||0)+1;
    return acc;
  }, {});

  const cards = `
    <div class="grid">
      <div class="card">
        <h3 style="margin:0 0 8px;">운영 현황</h3>
        <div class="muted" style="margin-bottom:12px;">MVP라서 단순하게. 대신 오래 가게.</div>
        <div class="post-meta">
          <span class="${scopeBadge("public")}">업무 ${counts.public||0}</span>
          <span class="${scopeBadge("health")}">건강 ${counts.health||0}</span>
          <span class="${scopeBadge("creative")}">창작 ${counts.creative||0}</span>
          <span class="${scopeBadge("dev")}">개발 ${counts.dev||0}</span>
        </div>
        <div class="muted">팁: 검색창에서 키워드 → 태그로 좁히기 → 영역 필터</div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 8px;">키보드</h3>
        <div class="muted" style="margin-bottom:12px;">업무 중에도 손이 덜 가게.</div>
        <div><span class="kbd">/</span> 검색 포커스</div>
        <div style="margin-top:6px;"><span class="kbd">Esc</span> 검색 해제</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 12px;">최근 기록</h3>
      <div class="post-list">
        ${list.slice(0, 20).map(p => `
          <div class="item" data-id="${p.id}">
            <div class="item__title">${escapeHtml(p.title)}</div>
            <div class="item__sub">
              <span class="${scopeBadge(p.scope)}">${SCOPE_LABEL[p.scope] || p.scope}</span>
              <span class="muted">${fmtDate(p.date)}</span>
              <span class="muted">${escapeHtml(p.summary || "")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  $("#view").innerHTML = cards;

  $$(".item").forEach(el=>{
    el.onclick = () => location.hash = `#/post/${el.dataset.id}`;
  });
}

function renderTimeline(){
  viewTitle("타임라인");

  const list = applyFilters(state.posts);

  // 날짜별 그룹
  const byDay = new Map();
  for (const p of list){
    if (!byDay.has(p.date)) byDay.set(p.date, []);
    byDay.get(p.date).push(p);
  }

  const days = [...byDay.keys()].sort((a,b)=>{
    const da = new Date(a+"T00:00:00");
    const db = new Date(b+"T00:00:00");
    return state.sort === "old" ? da - db : db - da;
  });

  const html = `
    <div class="card">
      <h3 style="margin:0 0 8px;">타임라인</h3>
      <div class="muted">기록은 흩어지면 힘이 약해지고, 묶이면 칼이 된다.</div>
    </div>

    ${days.map(day=>{
      const items = byDay.get(day) || [];
      return `
        <div class="card">
          <h3 style="margin:0 0 10px;">${escapeHtml(day)}</h3>
          <div class="post-list">
            ${items.map(p=>`
              <div class="item" data-id="${p.id}">
                <div class="item__title">${escapeHtml(p.title)}</div>
                <div class="item__sub">
                  <span class="${scopeBadge(p.scope)}">${SCOPE_LABEL[p.scope] || p.scope}</span>
                  <span class="muted">${escapeHtml((p.tags||[]).slice(0,6).map(t=>`#${t}`).join(" "))}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("")}
  `;

  $("#view").innerHTML = html;
  $$(".item").forEach(el=>{
    el.onclick = () => location.hash = `#/post/${el.dataset.id}`;
  });
}

async function renderPost(id){
  const p = state.posts.find(x => x.id === id);
  if (!p){
    viewTitle("글 없음");
    $("#view").innerHTML = `<div class="card">해당 글을 찾지 못했습니다. <a class="btn btn--ghost" href="#/">홈</a></div>`;
    return;
  }

  viewTitle(SCOPE_LABEL[p.scope] || "글");

  const res = await fetch(p.content, { cache: "no-store" });
  const md = await res.text();
  const html = mdToHtml(md);

  $("#view").innerHTML = `
    <article class="card">
      <h1 class="post-title">${escapeHtml(p.title)}</h1>
      <div class="post-meta">
        <span class="${scopeBadge(p.scope)}">${SCOPE_LABEL[p.scope] || p.scope}</span>
        <span class="badge">${fmtDate(p.date)}</span>
        ${(p.tags||[]).slice(0, 12).map(t=>`<span class="badge">#${escapeHtml(t)}</span>`).join("")}
      </div>
      <hr/>
      <div class="md">${html}</div>
      <hr/>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn--ghost" href="#/">목록</a>
        <button class="btn btn--ghost" type="button" id="copyLink">링크 복사</button>
      </div>
    </article>
  `;

  $("#copyLink").onclick = async () => {
    const url = location.href;
    try{
      await navigator.clipboard.writeText(url);
      $("#copyLink").textContent = "복사됨";
      setTimeout(()=>$("#copyLink").textContent="링크 복사", 900);
    }catch{
      alert("클립보드 접근이 막혀있습니다. 주소창에서 복사해주세요.");
    }
  };
}

function renderAbout(){
  viewTitle("운영 원칙");
  $("#view").innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 8px;">원칙(중요)</h3>
      <div class="md">
        <p><strong>웹에 올린 건 공개</strong>다. 정적 페이지에서 “숨김”은 보안이 아니다.</p>
        <p>민감한 기록(개인정보, 인사 관련 상세, 실명/기관 식별)은 <strong>로컬/프라이빗</strong>에 둔다.</p>
        <p>이 사이트에는 “공개 가능한 수준”으로 정제된 기록만 둔다. 그게 장기적으로 내 편이다.</p>
      </div>
      <hr/>
      <div class="muted">
        정책/업무 관련 기록은 “사실-근거-요청사항” 구조로 쓰면 나중에 문서화가 쉬워짐.
      </div>
    </div>
  `;
}

function renderNewGuide(){
  viewTitle("작성 가이드");
  $("#view").innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 8px;">새 글 추가 절차</h3>
      <div class="md">
        <ol>
          <li><code>content/</code>에 md 파일 생성 (예: <code>2025-12-24-003.md</code>)</li>
          <li><code>data/posts.json</code>에 메타데이터 1줄 추가</li>
          <li>push → GitHub Pages 반영</li>
        </ol>
        <p><strong>권장 템플릿</strong></p>
        <pre><code># 제목

&gt; 한 줄 목적(또는 결론)

## 사실/상황
- ...

## 판단/해석
- ...

## 다음 액션
- ...</code></pre>
      </div>
      <hr/>
      <div class="muted">업무용 기록은 “나중에 제출 가능한 문장”으로 쓰는 게 방어력이 좋다.</div>
    </div>
  `;
}

function reroute(hash){
  // 내비 오픈 상태면 닫아주기(모바일)
  $("#sidebar").classList.remove("is-open");

  const h = (hash || "#/").replace(/^#/, "");
  // 라우팅 규칙: /, /timeline, /about, /new, /post/:id
  const parts = h.split("/").filter(Boolean);

  if (parts.length === 0){
    renderHome(); return;
  }

  if (parts[0] === "timeline"){
    renderTimeline(); return;
  }
  if (parts[0] === "about"){
    renderAbout(); return;
  }
  if (parts[0] === "new"){
    renderNewGuide(); return;
  }
  if (parts[0] === "post" && parts[1]){
    renderPost(parts[1]); return;
  }

  // fallback
  renderHome();
}

function wire(){
  // 검색/필터 바인딩
  const q = $("#q");
  const scope = $("#scope");
  const sort = $("#sort");

  q.addEventListener("input", ()=>{
    state.q = q.value;
    reroute(location.hash);
  });

  scope.addEventListener("change", ()=>{
    state.scope = scope.value;
    reroute(location.hash);
  });

  sort.addEventListener("change", ()=>{
    state.sort = sort.value;
    reroute(location.hash);
  });

  // 키보드 단축키: / 검색, Esc 초기화
  window.addEventListener("keydown", (e)=>{
    if (e.key === "/" && document.activeElement !== q){
      e.preventDefault();
      q.focus();
    }
    if (e.key === "Escape"){
      if (document.activeElement === q){
        q.blur();
      }
      q.value = "";
      state.q = "";
      reroute(location.hash);
    }
  });

  // 테마
  $("#toggleTheme").onclick = ()=>{
    setTheme(state.theme === "light" ? "dark" : "light");
  };

  // 모바일 사이드바
  $("#toggleSidebar").onclick = ()=>{
    $("#sidebar").classList.toggle("is-open");
  };
}

async function main(){
  setTheme(state.theme);
  wire();
  await loadPosts();
  renderTags();
  reroute(location.hash || "#/");
  window.addEventListener("hashchange", ()=> reroute(location.hash));
}

main().catch(err=>{
  console.error(err);
  $("#view").innerHTML = `<div class="card">로드 실패. 콘솔을 확인해주세요.</div>`;
});
