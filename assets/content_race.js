// content_race.js
console.log("🟣 [RACE] AI Curator 자동화 스크립트 로드 완료!");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// React 환경에서 Input 값을 강제로 넣고 이벤트를 발생시키는 함수 (RACE 마스터 참조)
const setReactInputValue = (inputElement, value) => {
    if (!inputElement) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(inputElement, value);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
};

// DOM 버튼을 찾아 클릭하는 헬퍼 함수
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

chrome.runtime.onMessage.addListener(async (request) => {
    if (request.type === "EXECUTE_RACE_AUTOMATION") {
        console.log("🟣 [RACE] 자동화 시작!", request.data);
        const { blockTitle } = request.data;

        try {
            // 1. 블록명(타이틀) 찾아서 변경
            console.log("▶ 블록명 변경 시도:", blockTitle);
            let titleInput = null;
            
            // 타이틀이라는 라벨 옆의 Input 찾기
            const labelCandidates = Array.from(document.querySelectorAll('dt, th, td, label, span'));
            const labelEl = labelCandidates.find(el => el.textContent.includes('타이틀') || el.textContent.includes('블록명'));
            
            if (labelEl) {
                titleInput = labelEl.parentElement.querySelector('input[type="text"]') || 
                             (labelEl.nextElementSibling ? labelEl.nextElementSibling.querySelector('input[type="text"]') : null);
            }
            if (!titleInput) titleInput = document.querySelector('input[type="text"]');

            if (titleInput && blockTitle) {
                setReactInputValue(titleInput, blockTitle);
                console.log("✅ 블록명 변경 완료");
            } else {
                console.warn("⚠️ 블록명 입력창을 찾지 못했거나 타이틀이 비어있습니다.");
            }

            await sleep(1500);

            // 2. 저장 버튼 클릭
            console.log("▶ 저장 버튼 클릭 시도");
            let saveSuccess = await waitAndClick('저장', 5000) || await waitAndClick('생성', 2000);
            if (saveSuccess) {
                await sleep(1000);
                await waitAndClick('확인', 3000); // 저장 완료 팝업
                await sleep(1500);
            }

            // 3. 성수/수유 빌드 프로세스 (RACE 마스터 로직 그대로 이식)
            console.log("▶ 성수 빌드 시도");
            if (await waitAndClick('성수 빌드')) { 
                await sleep(1000); 
                await waitAndClick('예'); 
                await sleep(1000); 
                await waitAndClick('확인', 25000); // 서버 지연 대비
            }

            await sleep(2000);

            console.log("▶ 수유 빌드 시도");
            if (await waitAndClick('수유 빌드')) { 
                await sleep(1000); 
                await waitAndClick('예'); 
                await sleep(1000); 
                await waitAndClick('확인', 25000); 
            }

            alert(`✨ [AI Curator] EUXP 주입 및 RACE [${blockTitle}] 빌드가 모두 완료되었습니다!`);

        } catch (error) {
            console.error("❌ RACE 자동화 에러:", error);
            alert("RACE 자동화 중 오류 발생: " + error.message);
        }
    }
});
