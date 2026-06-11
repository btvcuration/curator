// background.js

// --- Helper: 탭 로딩 대기 ---
function waitForTabLoad(tabId) {
    return new Promise(resolve => {
        const listener = (uTabId, info) => {
            if (uTabId === tabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // 무한 대기 방지 (최대 6초 후 강제 진행)
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 6000); 
    });
}

// --- Helper: 특정 URL로 이동하여 성수/수유 빌드 콤보 실행 ---
async function runBuildOnUrl(tabId, url, typeName) {
    await chrome.tabs.update(tabId, { url });
    await waitForTabLoad(tabId);
    await new Promise(r => setTimeout(r, 2000)); // 리액트 렌더링 대기
    
    console.log(`[RACE] ${typeName} 빌드 시도: ${url}`);

    await chrome.scripting.executeScript({
        target: { tabId },
        args: [typeName],
        func: async (type) => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const waitAndClick = async (btnName, timeout = 15000) => {
                const start = Date.now();
                while (Date.now() - start < timeout) {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === btnName);
                    if (btn && btn.offsetParent !== null) { 
                        btn.click(); 
                        return true; 
                    }
                    await sleep(500);
                }
                return false;
            };

            console.log(`▶ [${type}] 성수 빌드 시도`);
            if (await waitAndClick('성수 빌드', 5000)) { 
                await sleep(1000); 
                await waitAndClick('예', 3000); 
                await sleep(1000); 
                await waitAndClick('확인', 25000); 
            }

            await sleep(2000);

            console.log(`▶ [${type}] 수유 빌드 시도`);
            if (await waitAndClick('수유 빌드', 5000)) { 
                await sleep(1000); 
                await waitAndClick('예', 3000); 
                await sleep(1000); 
                await waitAndClick('확인', 25000); 
            }
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. EUXP 탭 열고 주입
    if (request.type === "OPEN_EUXP_AND_UPLOAD") {
        const euxpUrl = "https://euxp.skbroadband.com:8443/menu/libmen/libMen.do";
        chrome.tabs.create({ url: euxpUrl }, (tab) => {
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "EXECUTE_EUXP_AUTOMATION",
                    data: request.data.data
                });
            }, 4000); 
        });
    }

    // 2. EUXP 완료 -> RACE 순차 프로세스 실행
    if (request.type === "EUXP_COMPLETED") {
        const data = request.data;
        const blockTitle = data.blockTitle;
        
        // 주입 완료된 EUXP 탭 닫기
        if (sender.tab && sender.tab.id) chrome.tabs.remove(sender.tab.id);

        if (data.targetRaceId && data.targetRaceId.trim() !== "") {
            const targetId = data.targetRaceId.trim();
            const isReference = targetId.toLowerCase().includes('.race');
            const folder = isReference ? 'Reference' : 'Block';
            const initialUrl = `http://1.255.152.46:5630/usecase/${folder}/${targetId}`;
            
            // Background에서 비동기 흐름 오케스트레이션
            (async () => {
                // [STEP 1] RACE 초기 화면 띄우기
                const tab = await chrome.tabs.create({ url: initialUrl });
                await waitForTabLoad(tab.id);
                await new Promise(r => setTimeout(r, 2000));

                // [STEP 2] 라벨 수정 및 ID(블록/레퍼런스) 추출
                const extractRes = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [blockTitle],
                    func: async (newTitle) => {
                        const sleep = ms => new Promise(r => setTimeout(r, ms));
                        const setReactInputValue = (inputElement, value) => {
                            if (!inputElement) return;
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            if (setter) setter.call(inputElement, value);
                            else inputElement.value = value;
                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                        };

                        const waitAndClick = async (btnName, timeout = 10000) => {
                            const start = Date.now();
                            while (Date.now() - start < timeout) {
                                const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === btnName);
                                if (btn && btn.offsetParent !== null) { btn.click(); return true; }
                                await sleep(500);
                            }
                            return false;
                        };

                        // 블록 편집 클릭 및 라벨 변경
                        await waitAndClick('블록 편집', 6000);
                        await sleep(1500);

                        if (newTitle) {
                            let titleInput = document.querySelector('input[placeholder*="블록 레이블"]');
                            if (!titleInput) {
                                const labelEl = Array.from(document.querySelectorAll('dt, th, td, label, span, p')).find(el => el.textContent.trim() === '블록 레이블');
                                if (labelEl) titleInput = labelEl.parentElement.querySelector('input[type="text"]') || (labelEl.nextElementSibling ? labelEl.nextElementSibling.querySelector('input[type="text"]') : null);
                            }
                            if (titleInput) {
                                setReactInputValue(titleInput, newTitle);
                                await sleep(1000);
                                if (await waitAndClick('변경', 5000)) {
                                    await sleep(1000); await waitAndClick('확인', 5000); await sleep(2000);
                                } else if (await waitAndClick('저장', 3000)) {
                                    await sleep(1000); await waitAndClick('확인', 3000); await sleep(2000);
                                }
                            }
                        }

                        // 블록 ID 및 레퍼런스 ID 화면에서 긁어오기
                        const dts = Array.from(document.querySelectorAll('dt'));
                        const getCleanId = (text) => text.match(/(.*?\.(block|race))/i)?.[1] || text.trim();
                        const bRaw = dts.find(el => el.textContent.includes('블록 타이틀'))?.nextElementSibling?.textContent || '';
                        const rRaw = dts.find(el => el.textContent.includes('레퍼런스 타이틀'))?.nextElementSibling?.textContent || '';
                        
                        return { blockId: getCleanId(bRaw), raceId: getCleanId(rRaw) };
                    }
                });

                const ids = extractRes[0]?.result;
                if (!ids || !ids.blockId) {
                    chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => alert("❌ RACE ID(블록 타이틀) 추출에 실패하여 빌드를 진행할 수 없습니다.") });
                    return;
                }

                // [STEP 3] 블록 페이지로 강제 이동하여 빌드
                const blockUrl = `http://1.255.152.46:5630/usecase/Block/${ids.blockId}`;
                await runBuildOnUrl(tab.id, blockUrl, '블록');

                // [STEP 4] 레퍼런스 페이지로 강제 이동하여 빌드 (레퍼런스가 있는 경우만)
                if (ids.raceId && ids.raceId.toLowerCase() !== 'null' && ids.raceId !== '') {
                    const raceUrl = `http://1.255.152.46:5630/usecase/Reference/${ids.raceId}`;
                    await runBuildOnUrl(tab.id, raceUrl, '레퍼런스');
                }

                // [STEP 5] 최종 축하 알림
                chrome.scripting.executeScript({ 
                    target: { tabId: tab.id }, 
                    args: [blockTitle],
                    func: (title) => alert(`✨ [AI Curator] EUXP 주입 및 RACE [${title}] 블록/레퍼런스 빌드가 완벽히 완료되었습니다!`)
                });

            })();
        }
    }
});
