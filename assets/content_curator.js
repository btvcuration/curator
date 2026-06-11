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