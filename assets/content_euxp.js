// content_euxp.js
console.log("🔵 [EUXP] 자동화 스크립트 로드 완료! (메뉴명 변경 로직 제거됨)");

const b64toBlob = (b64Data, contentType='', sliceSize=512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, {type: contentType});
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getFrameDoc = () => {
    const frames = document.querySelectorAll('iframe, frame');
    for (let frame of frames) {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            if (doc) return doc;
        } catch(e) {}
    }
    return document;
};

const findVisible = (selector) => {
    const doc = getFrameDoc();
    const els = Array.from(doc.querySelectorAll(selector));
    return els.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
};

const findByText = (selector, text) => {
    const doc = getFrameDoc();
    const els = Array.from(doc.querySelectorAll(selector));
    return els.find(el => el.textContent.trim() === text && el.offsetWidth > 0);
};

const triggerClick = (el) => {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    el.click();
};

chrome.runtime.onMessage.addListener(async (request) => {
    if (request.type === "EXECUTE_EUXP_AUTOMATION") {
        console.log("🔵 [EUXP] 자동화 시작!", request.data);
        const { targetLibraryId, fileData, fileName } = request.data;

        try {
            // 1. 상세검색 및 라이브러리 선택
            if (targetLibraryId) {
                console.log("▶ 상세검색 탭 이동");
                let searchTab = findByText('a, span', '상세검색');
                if (searchTab) triggerClick(searchTab);
                else throw new Error("상세검색 탭을 찾을 수 없습니다.");
                
                await delay(1000);
                
                console.log("▶ 라이브러리 ID 입력");
                let idInput = findVisible('input[name="menuBasId"]');
                if (idInput) {
                    idInput.focus();
                    idInput.value = targetLibraryId;
                    idInput.dispatchEvent(new Event('input', { bubbles: true }));
                    idInput.dispatchEvent(new Event('change', { bubbles: true }));
                    idInput.blur();
                } else {
                    throw new Error("라이브러리 ID 입력창을 찾을 수 없습니다.");
                }

                console.log("▶ 검색 버튼 클릭");
                let searchBtn = findVisible('#librarySearchBtn');
                if (searchBtn) triggerClick(searchBtn);
                
                await delay(2000); 

                console.log("▶ jsTree 검색 결과 선택");
                let doc = getFrameDoc();
                let targetAnchor = doc.querySelector(`a[data-menu-bas-id="${targetLibraryId}"]`) || 
                                   Array.from(doc.querySelectorAll('a.jstree-anchor')).find(el => el.textContent.includes(targetLibraryId));
                
                if (targetAnchor) {
                    triggerClick(targetAnchor);
                } else {
                    throw new Error("검색 결과 트리에서 라이브러리를 선택할 수 없습니다.");
                }
                await delay(1000);
            }

            // 2. 콘텐츠 편성 관리 탭 이동
            console.log("▶ 콘텐츠 편성 관리 탭 이동");
            let contentTab = findByText('a, span', '콘텐츠 편성 관리');
            if (contentTab) triggerClick(contentTab);
            else throw new Error("콘텐츠 편성 관리 탭을 찾을 수 없습니다.");
            
            await delay(2000); 

            // 2.5 기존 편성 데이터 삭제 로직
            console.log("▶ 기존 편성 내역 삭제 시도");
            let doc = getFrameDoc();
            let mainSelectAllCb = findVisible('input[type="checkbox"][id^="cb_"]') || doc.querySelector('th input[type="checkbox"]');
            
            if (mainSelectAllCb) {
                if (!mainSelectAllCb.checked) {
                    triggerClick(mainSelectAllCb);
                    await delay(500);
                }

                let deleteBtn = findByText('button, a, span', '편성 삭제') || findByText('button, a, span', '삭제');
                if (deleteBtn) {
                    triggerClick(deleteBtn);
                    console.log("✅ 편성 삭제 버튼 클릭");
                    await delay(1000);

                    let btnOkDelete = findVisible('#btnOk') || findByText('button', '확인');
                    if (btnOkDelete) triggerClick(btnOkDelete);

                    await delay(1500);

                    let btnOkDeleteConfirm = findVisible('#btnOk') || findByText('button', '확인');
                    if (btnOkDeleteConfirm) triggerClick(btnOkDeleteConfirm);

                    console.log("✅ 기존 편성 삭제 완료");
                    await delay(1500); 
                }
            }

            // 3. 일괄편성 버튼 클릭
            console.log("▶ 일괄편성 버튼 클릭");
            let bulkBtn = findVisible('#parallelCntsOrgnzBtn');
            if (bulkBtn) triggerClick(bulkBtn);
            else throw new Error("일괄편성 버튼을 찾을 수 없습니다.");
            
            await delay(1500);

            // 4. 진짜 엑셀 파일 주입
            console.log("▶ 엑셀 파일 주입 중...");
            let fileInput = doc.querySelector('input[name="excelFile"]') || doc.querySelector('input[type="file"]');
            
            if (fileInput) {
                const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                const blob = b64toBlob(fileData, contentType);
                const excelFile = new File([blob], fileName, { type: contentType });

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(excelFile);
                fileInput.files = dataTransfer.files;
                
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log("✅ 파일 주입 완료!");
            } else {
                throw new Error("파일 업로드 태그(<input type='file'>)를 찾을 수 없습니다.");
            }

            await delay(3000); 

            // 5. 전체 선택 및 편성 추가
            console.log("▶ 팝업 내 리스트 전체 선택 및 편성 추가");
            let popupSelectAllCb = findVisible('#cb_parallelCntsOrgnzList');
            if (popupSelectAllCb && !popupSelectAllCb.checked) {
                triggerClick(popupSelectAllCb);
                await delay(500);
            }

            let addBtn = findVisible('#addParallelOrgnzCntsBtn');
            if (addBtn) triggerClick(addBtn);

            await delay(1500);
            
            // 6. 팝업 창 연달아 확인 누르기
            console.log("▶ 편성 추가 승인 처리");
            let btnOk1 = findVisible('#btnOk'); 
            if (btnOk1) triggerClick(btnOk1);
            
            await delay(1500);

            let btnOk2 = findVisible('#btnOk'); 
            if (btnOk2) triggerClick(btnOk2);
            
            await delay(1000);

            // 7번 단계(메뉴명 변경 및 저장)가 완전히 제거되었습니다.

            alert("✨ AI Curator 데이터 자동 편성이 완료되었습니다!");

        } catch (error) {
            console.error("❌ 자동화 에러:", error);
            alert("자동화 중단: " + error.message);
        }
    }
});