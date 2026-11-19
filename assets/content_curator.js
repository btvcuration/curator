// content_curator.js
console.log("🟢 [AI Curator] 익스텐션 감지 스크립트 로드됨");

window.addEventListener("message", (event) => {
    // 웹페이지(React)에서 보낸 SEND_TO_EUXP 메시지만 필터링
    if (event.data && event.data.type === "SEND_TO_EUXP") {
        console.log("🟢 [AI Curator] 엑셀 데이터 수신, 백그라운드로 전달합니다.");
        
        // [추가된 안전장치] 크롬 익스텐션 권한이 유효한지 확인
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: "OPEN_EUXP_AND_UPLOAD",
                data: event.data
            });
        } else {
            // 권한이 없어진 상태(확장프로그램 재시작 후 탭 새로고침 안 함)일 때 경고
            alert("확장 프로그램이 업데이트되었습니다. 원활한 전송을 위해 키보드 F5를 눌러 현재 창을 새로고침한 뒤 다시 시도해주세요!");
        }
    }
});

// 🖼️ [추가] 추천 결과 카드에 NCMS 포스터 표시
//  - AI Curator 화면에서만 동작 (페이지 코드는 수정하지 않고, 카드의 시리즈ID(CS…)를 읽어 포스터 칸을 끼워 넣음)
//  - 포스터 주소는 background가 "로그인된 NCMS 탭" 안에서 조회해 돌려줌. NCMS 탭이 없으면 빈 칸으로 둠
//  - 조회한 주소는 이 페이지 저장소에 캐시(찾음 7일 / 포스터 없음 1일)
(() => {
    if (document.title !== "AI Curator Admin") return;

    const CACHE_KEY = "ncmsPosterCache.v1";
    const TTL_HIT = 7 * 24 * 3600 * 1000, TTL_MISS = 24 * 3600 * 1000;
    const W = 46, H = 66;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch (e) { cache = {}; }
    const now = () => Date.now();
    const cached = (id) => {
        const c = cache[id];
        if (!c) return undefined;
        if (now() - c.t > (c.u ? TTL_HIT : TTL_MISS)) { delete cache[id]; return undefined; }
        return c.u;
    };
    const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {} };

    // 상태: ok / no_ncms(NCMS 탭 없음) / no_login(로그인 안 됨) / no_ext(확장 연결 끊김)
    let lastStatus = "ok", lastFailAt = 0, busy = false;
    const pending = new Set();
    const STATUS_TEXT = {
        no_ncms: "NCMS 탭을 열고 로그인하면 포스터가 보여요 (클릭: 다시 시도)",
        no_login: "NCMS 로그인이 필요해요 (클릭: 다시 시도)",
        no_ext: "확장프로그램이 새로고침됐어요. 이 페이지를 F5로 새로고침해 주세요",
    };

    const makeBox = (id) => {
        const box = document.createElement("div");
        box.dataset.ncmsPoster = id;
        box.style.cssText = `width:${W}px;height:${H}px;flex:none;border-radius:6px;overflow:hidden;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8;text-align:center;line-height:1.2;margin-top:2px;cursor:default;`;
        // 카드의 꾹 눌러 선택·드래그와 겹치지 않게
        box.addEventListener("mousedown", (e) => e.stopPropagation());
        box.addEventListener("click", (e) => {
            e.stopPropagation();
            if (box.dataset.state === "fail") { lastFailAt = 0; pending.add(id); schedule(0); }
        });
        return box;
    };

    const paint = (box) => {
        const id = box.dataset.ncmsPoster;
        const u = cached(id);
        // 상태가 바뀔 때만 다시 그림 (그리기 자체가 MutationObserver를 다시 깨우므로 반복 방지)
        const key = u ? "img:" + u : u === "" ? "none" : lastStatus !== "ok" ? "fail:" + lastStatus : "wait";
        if (box.dataset.key === key || (box.dataset.state === "noimg" && key === "img:" + u)) return;
        box.dataset.key = key;
        if (u) {
            box.dataset.state = "img"; box.title = id; box.style.cursor = "default";
            box.innerHTML = "";
            const img = document.createElement("img");
            img.src = u; img.alt = ""; img.draggable = false; img.referrerPolicy = "no-referrer";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
            img.onerror = () => { box.dataset.state = "noimg"; box.textContent = "이미지 오류"; box.title = u; };
            box.appendChild(img);
        } else if (u === "") {
            box.dataset.state = "none"; box.textContent = "포스터 없음"; box.title = id; box.style.cursor = "default";
        } else if (lastStatus !== "ok") {
            box.dataset.state = "fail"; box.textContent = "NCMS"; box.title = STATUS_TEXT[lastStatus] || ""; box.style.cursor = "pointer";
        } else {
            box.dataset.state = "wait"; box.textContent = "…"; box.title = "포스터 불러오는 중";
        }
    };

    // 카드 찾기: 결과 카드 안의 ID 표시(font-mono)가 CS로 시작하면 대상
    const scan = () => {
        document.querySelectorAll("span.font-mono").forEach((span) => {
            const id = (span.textContent || "").trim();
            if (!/^CS\w+$/.test(id)) return;
            const row = span.closest(".flex.items-start.gap-3");
            if (!row || !row.firstElementChild) return;
            let box = row.querySelector(":scope > [data-ncms-poster]");
            if (box && box.dataset.ncmsPoster !== id) { box.remove(); box = null; } // 같은 카드에 다른 작품이 들어온 경우
            if (!box) { box = makeBox(id); row.firstElementChild.after(box); }
            if (cached(id) === undefined) pending.add(id);
            paint(box);
        });
        if (pending.size) schedule(300);
    };

    let timer = null;
    const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(fetchPending, ms); };
    const repaint = () => document.querySelectorAll("[data-ncms-poster]").forEach(paint);
    const fail = (st) => { lastStatus = st; lastFailAt = now(); repaint(); };

    const fetchPending = () => {
        if (busy || !pending.size) return;
        if (lastStatus !== "ok" && now() - lastFailAt < 30000) return; // 실패 직후엔 30초 쉬고, 칸 클릭 시 즉시 재시도
        if (!(chrome.runtime && chrome.runtime.id)) return fail("no_ext");
        const ids = [...pending].slice(0, 60);
        busy = true;
        try {
            chrome.runtime.sendMessage({ type: "NCMS_POSTERS", ids }, (res) => {
                busy = false;
                if (chrome.runtime.lastError || !res) return fail("no_ext");
                if (res.status !== "ok") return fail(res.status || "no_ncms");
                lastStatus = "ok";
                ids.forEach((id) => { pending.delete(id); cache[id] = { u: (res.posters && res.posters[id]) || "", t: now() }; });
                saveCache();
                repaint();
                if (pending.size) schedule(0);
            });
        } catch (e) { busy = false; fail("no_ext"); }
    };

    let raf = 0;
    new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); })
        .observe(document.body, { childList: true, subtree: true });
    scan();
})();