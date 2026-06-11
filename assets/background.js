// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // 1단계: EUXP 실행 요청
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

    // 2단계: EUXP 완료 -> RACE 탭 열기
    if (request.type === "EUXP_COMPLETED") {
        const data = request.data;
        
        // EUXP 탭 닫기
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }

        // RACE ID가 존재하면 RACE 창 띄우기 (RACE Extension 로직 참고)
        if (data.targetRaceId && data.targetRaceId.trim() !== "") {
            const isReference = data.targetRaceId.toLowerCase().includes('.race');
            const folder = isReference ? 'Reference' : 'Block';
            const raceUrl = `http://1.255.152.46:5630/usecase/${folder}/${data.targetRaceId}`;
            
            chrome.tabs.create({ url: raceUrl }, (tab) => {
                setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: "EXECUTE_RACE_AUTOMATION",
                        data: data
                    });
                }, 5000); // RACE 페이지 로딩 대기
            });
        }
    }
});
