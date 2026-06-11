// content_race.js
console.log("🟣 [RACE] AI Curator 자동화 스크립트 로드 완료!");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// React 환경에서 Input 값을 강제로 넣고 이벤트를 발생시키는 함수
const setReactInputValue = (inputElement, value) => {
    if (!inputElement) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(inputElement, value);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
};

// DOM 버튼을 텍스트 기반으로 찾아 클릭하는 헬퍼 함수
const waitAndClick = async (btnName, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === btnName);
        if (btn && btn.offsetParent !== null) { // 버튼이 화면에 보일 때만 클릭
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
            // 💡 1 & 2단계: URL 이동(background에서 처리됨) 후 '블록 편집' 버튼 클릭
            console.log("▶ '블록 편집' 버튼 클릭 시도");
            let editBtnSuccess = await waitAndClick('블록 편집', 10000);
            if (!editBtnSuccess) {
                console.warn("⚠️ '블록 편집' 버튼을 찾지 못했습니다. 이미 편집 모드라고 가정하고 진행합니다.");
            }
            await sleep(1500); // 팝업/UI 렌더링 대기

            // 💡 3단계: '블록 레이블' 필드 찾아서 값 입력
            console.log("▶ 블록 레이블 변경 시도:", blockTitle);
            let titleInput = null;
            const labelCandidates = Array.from(document.querySelectorAll('dt, th, td, label, span'));
            const labelEl = labelCandidates.find(el => el.textContent.includes('블록 레이블') || el.textContent.includes('타이틀'));
            
            if (labelEl) {
                titleInput = labelEl.parentElement.querySelector('input[type="text"]') || 
                             (labelEl.nextElementSibling ? labelEl.nextElementSibling.querySelector('input[type="text"]') : null);
            }
            
            // 못 찾았을 경우 화면에 보이는 첫 번째 text input을 찾음
            if (!titleInput) {
                titleInput = Array.from(document.querySelectorAll('input[type="text"]')).find(el => el.offsetParent !== null);
            }

            if (titleInput && blockTitle) {
                setReactInputValue(titleInput, blockTitle);
                console.log("✅ '블록 레이블' 입력 완료");
            } else {
                throw new Error("블록 레이블 입력창을 찾을 수 없습니다.");
            }

            await sleep(1000);

            // 💡 4단계: '변경' 버튼 클릭 후 팝업 '확인' 클릭
            console.log("▶ '변경' 버튼 클릭 시도");
            let changeSuccess = await waitAndClick('변경', 5000);
            if (changeSuccess) {
                console.log("✅ '변경' 버튼 클릭 완료. 확인 팝업 대기...");
                await sleep(1000);
                await waitAndClick('확인', 5000); // 팝업창 확인 버튼
                console.log("✅ 변경 팝업 '확인' 완료");
                await sleep(2000); // 빌드 전 화면 안정화 대기
            } else {
                // '변경' 버튼이 없고 '저장' 버튼이 있을 경우의 예외 처리
                let saveSuccess = await waitAndClick('저장', 3000) || await waitAndClick('생성', 2000);
                if (saveSuccess) {
                    await sleep(1000);
                    await waitAndClick('확인', 3000);
                    await sleep(1500);
                }
            }

            // 💡 5단계: 빌드 돌리기 (기존 성수/수유 빌드 프로세스)
            // 만약 RACE 어드민 화면 버튼 이름이 '블록 빌드', '레퍼런스 빌드'라면 이 문자열을 수정해주세요!
            console.log("▶ 성수 빌드 시도");
            if (await waitAndClick('성수 빌드')) { 
                await sleep(1000); 
                await waitAndClick('예'); 
                await sleep(1000); 
                await waitAndClick('확인', 25000);
            }

            await sleep(2000);

            console.log("▶ 수유 빌드 시도");
            if (await waitAndClick('수유 빌드')) { 
                await sleep(1000); 
                await waitAndClick('예'); 
                await sleep(1000); 
                await waitAndClick('확인', 25000); 
            }

            alert(`✨ [AI Curator] EUXP 주입 및 RACE [${blockTitle}] 자동 변경/빌드가 모두 완료되었습니다!`);

        } catch (error) {
            console.error("❌ RACE 자동화 에러:", error);
            alert("RACE 자동화 중 오류 발생: " + error.message);
        }
    }
});
