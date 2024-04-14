let eventStop = false;
let addOpen = false;

function disableDAnimePopup (): void {
  const url = new URL(location.href);
  if (url.pathname === '/animestore/ci_pc') {
    const observer = new MutationObserver(() => {
      const streamingQuality = document.getElementById('streamingQuality');
      const playDiv = document.querySelector('modal .playerContainer > div');
      if (streamingQuality != null &&
        document.getElementById('openVideo') == null &&
        playDiv != null
      ) {
        streamingQuality.remove();
        const partId = new URL(location.href).searchParams.get('partId');
        const openUrl = 'https://animestore.docomo.ne.jp/animestore/sc_d_pc?partId=' + partId;
        const div = `<div class="list"><a id="openVideo" class="normal" href="${openUrl}" target="_self" rel="noopener noreferrer" style="cursor: pointer;">視聴する</a></div>`;
        playDiv.insertAdjacentHTML('afterbegin', div);
      }
    });
    const config = { childList: true, subtree: true };
    observer.observe(document.body, config);
  } else if (url.pathname === '/animestore/tp_pc') {
    const observer = new MutationObserver(() => {
      // リンク先変更
      const itemLists = document.querySelectorAll('.itemWrapper > .p-slider__item > a.c-slide');
      if (itemLists.length === 0) { return }
      for (const itemList of itemLists) {
        const attr = itemList.getAttribute('href');
        if (attr != null) {
          const workId = new URL(attr).searchParams.get('workId');
          const url = 'https://animestore.docomo.ne.jp/animestore/ci_pc?workId=' + workId;
          itemList.setAttribute('href', `${url}`);
        }
      }

      // 新規ウィンドウで開くeventを無効化
      const playerImg = document.querySelectorAll('.thumbnailContainer > a > .imgWrap16x9')[0];
      if (!eventStop && playerImg != null) {
        playerImg.addEventListener('click', e => {
          e.stopPropagation();
        })
        const playerProg = document.querySelector('.thumbnailContainer > a > .progress');
        if (playerProg != null) {
          playerProg.addEventListener('click', e => {
            e.stopPropagation();
          });
        }

        eventStop = true;
        // アイコンのeventが削除できないので、imgWrap16x9の子に移動する
        const iconPlay = document.querySelector('.thumbnailContainer > a > i');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (iconPlay != null) ? playerImg.appendChild(iconPlay) : '';

        // サムネイルをクリックすると新規タブで開く
        const attr = document.querySelector('.thumbnailContainer > a')?.getAttribute('data-partid');
        if (attr != null) {
          const openUrl = 'https://animestore.docomo.ne.jp/animestore/sc_d_pc?partId=' + attr;
          const pageHeader = document.querySelector('.pageHeader');
          if (!addOpen && pageHeader != null) {
            pageHeader.addEventListener('click', () => {
              location.assign(openUrl);
            });
            // 画像をホバーしても、上のでは動かないので
            playerImg.addEventListener('click', () => {
              location.assign(openUrl);
            });
            addOpen = true;
          }
        }

        const directPlayReady = document.querySelector('a.directPlayReady');
        const playDiv = document.querySelector('div.information > div.btnResume.onlyPcLayout');
        if (directPlayReady != null &&
          document.getElementById('openVideo') == null &&
          playDiv != null
        ) {
          directPlayReady.remove();
          const openUrl = 'https://animestore.docomo.ne.jp/animestore/sc_d_pc?partId=' + attr;
          const div = `<a id="openVideo" class="normal" href="${openUrl}" target="_self" rel="noopener noreferrer" style="cursor: pointer;">続きから視聴する<i class="icon iconResume"></i></a>`;
          playDiv.insertAdjacentHTML('afterbegin', div);
        }
      }
    });
    const config = { childList: true, subtree: true };
    observer.observe(document.body, config);
  }
}

disableDAnimePopup();
