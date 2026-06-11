// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "OPEN_EUXP_AND_UPLOAD") {
        const euxpUrl = "https://euxp.skbroadband.com:8443/menu/libmen/libMen.do";
        
        // 1. EUXP 어드민 탭을 엽니다.
        chrome.tabs.create({ url: euxpUrl }, (tab) => {
            
            // 2. 탭이 열리고 페이지가 로딩될 때까지 충분히 기다립니다 (예: 4초)
            setTimeout(() => {
                // 3. 로딩된 EUXP 탭으로 데이터와 함께 자동화 실행 명령을 내립니다.
                chrome.tabs.sendMessage(tab.id, {
                    type: "EXECUTE_EUXP_AUTOMATION",
                    data: request.data.data
                });
            }, 4000); 
        });
    }
});