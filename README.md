# work-summary

Claude Code mod. 파일을 바꾼 턴이 끝나면 오른쪽 패널에 **바꾼 파일 · 한 일 · 배울 점**을 짧게 정리합니다.

```
[ 바꾼 파일 ] [ 한 일 ] [ 배울 점 ]

▸ 홈 버튼 고쳐줘
  • 홈 버튼 색을 design-guide 토큰으로 교체
```

## 설치

터미널의 Claude Code 프롬프트에서:

```
/plugin marketplace add timinguniq/claude-work-summary
/plugin install work-summary@claude-work-summary
```

또는 셸에서:

```
claude plugin marketplace add timinguniq/claude-work-summary
claude plugin install work-summary@claude-work-summary
```

user 범위로 설치되어 이후 새 세션에서 켜집니다. 이미 열려 있는 세션에서는 `/reload-plugins`로 불러옵니다.

업데이트: `claude plugin update work-summary` 후 `/reload-plugins`.

## 동작

- 패널 위의 탭(**바꾼 파일 · 한 일 · 배울 점**)을 누르면 모든 항목에서 그 부분만 보입니다. 처음에는 바꾼 파일 탭이 열립니다.
- **바꾼 파일**: Edit · Write · NotebookEdit 도구로 바꾼 파일. 서브에이전트가 바꾼 것도 포함하고, 실패하거나 거부된 수정은 뺍니다. 턴이 끝나자마자 보입니다.
- **한 일 · 배울 점**: 턴이 끝난 뒤 세션 대화를 같은 모델로 한 번 더 보내(fork) 만듭니다. 그동안은 "요약 중…"이 보입니다.
- 패널은 세션을 시작할 때 열리고, 터미널 폭이 144칸보다 좁으면 기다립니다. `/work-summary`로 직접 열면 폭과 상관없이 뜹니다.
- 최근 20개 항목을 세션 안에서만 보관합니다.

## 주의

- 파일을 바꾼 턴마다 모델 호출이 한 번 더 일어납니다. 대화 앞부분은 프롬프트 캐시로 처리되지만 비용이 듭니다.
- Claude Code의 function hook mod API는 early access라 버전에 따라 바뀔 수 있습니다. Claude Code 2.1.290에서 만들고 테스트했습니다.

## 개발

```
claude plugin validate .
claude plugin test .
```
