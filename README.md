# 월하서간 月下書簡

달빛 아래 남긴 편지. 조선의 작은 서고를 상상한 편지 읽기 사이트입니다.

## 미리 보기

`index.html`을 브라우저에서 열면 됩니다. 별도의 설치나 빌드가 필요 없습니다.

## 내용과 기능

- 창작 편지 6통, 각 3장
- 봉투를 골라 읽기, 앞뒤 장 넘기기, 방향키 탐색
- 봄·겨울 분류, 책갈피, 읽던 위치 복원
- 낮과 밤 테마, 모바일 레이아웃
- 브라우저 localStorage에 책갈피와 읽던 위치 보관

외부 Google Fonts가 연결되지 않으면 기기의 바탕체로 표시됩니다. 나머지 기능과 삽화는 외부 서비스 없이 동작합니다. 편지 내용과 풍경은 실제 사료가 아닌 창작입니다.

## 편지 바꾸기

`index.html` 아래쪽의 `letters` 배열에서 `title`, `date`, `to`, `excerpt`, `from`, `pages`를 수정합니다. `pages`의 각 항목이 편지의 한 장입니다. 편지 `id`를 유지하면 기존 읽기 기록도 유지됩니다.

배경 삽화는 문서 위쪽 `landscape` SVG 심볼입니다. 추후 별도 이미지로 교체할 수 있습니다.

## GitHub Pages

이 폴더 안의 파일을 새 저장소의 최상위에 올립니다. GitHub 저장소의 Settings → Pages에서 Deploy from a branch, `main`, `/ (root)`를 선택하고 저장합니다.

저장소: https://github.com/JuHyeon-05/wolha-seogan

