// const VIDEO_STATE_INTERVAL_HIGH = 50;
const VIDEO_STATE_INTERVAL_LOW = 1000;

const enum PauseReason {
  none = 0,
  buffering = 1,
  userInteraction = 2,
};

const qpList = [
  {
    url: 'https://www.youtube.com/watch',
    vqPath: 'video.video-stream.html5-main-video',
  },
];
let vQuery: HTMLVideoElement | undefined;
let vPlayTime: number = 0;
/* let videoStateLoop = */ setInterval(getVideoState, VIDEO_STATE_INTERVAL_LOW);
let videoSpeedChangeAfter: number = 0;

function getVideoState (): void {
  if (!isTargetURL()) return;

  if (vQuery == null) {
    const cURL = new URL(document.URL);
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const queryPath = qpList.find((x) => x.url === cURL.origin + cURL.pathname)?.vqPath as string;

    const query = document.querySelector(queryPath);
    if (query != null) {
      vQuery = query as HTMLVideoElement;
      vQuery.addEventListener('seeked', eventSeek);
    }
  }

  if (vQuery != null) {
    const currentBeginPoint = new Date(
      new Date().getTime() - Math.floor(vQuery.currentTime * 1000)
    );
    /* console.log(
      `setInterval e:${vQuery.seekable.length} t:${
        vQuery.currentTime
      } d:${currentBeginPoint.toISOString()} r:${vQuery.readyState} p:${
        vQuery.paused
      }`
    ); */
    // readyStateが0～3はグルってる（buffer取得による停止）状態かと思われる。4だと十分に再生されている。
    // pausedはユーザーによる操作
    // (readyState === 4 && !paused) === true が再生中ということでいいと思う

    let mtime = Math.floor(vQuery.currentTime * 1000);
    let pauseReason = PauseReason.none;
    const playing = vQuery.readyState === 4 && !vQuery.paused;
    if (playing) {
      mtime = currentBeginPoint.getTime();
    } else {
      if (vQuery.paused) {
        pauseReason = PauseReason.userInteraction;
      } else {
        pauseReason = PauseReason.buffering;
      }
    }

    if (Math.abs(vPlayTime - mtime) > 100) {
      void chrome.runtime.sendMessage({
        playing,
        ptime: mtime,
        pauseReason,
        duration: vQuery.duration,
        url: document.URL,
      } satisfies VideoPlayingInfo);

      vPlayTime = mtime;
    }
  }
}

function eventSeek (): void {
  if (!isTargetURL()) return;

  if (vQuery != null) {
    console.log(
      `eventSeek cTime:${vQuery.currentTime} cState:${vQuery.readyState} cPause:${vQuery.paused}`
    );
  }
}

function isTargetURL (): boolean {
  const cURL = new URL(document.URL);
  return qpList.findIndex((x) => x.url === cURL.origin + cURL.pathname) !== -1;
}

chrome.runtime.onMessage.addListener((message) => {
  const adjustMessage = message as AdjustMessage;
  opFunctions.filter(x => x.kind === message.kind).forEach(x => { x.fn(adjustMessage); });
});

const opFunctions = [
  {
    kind: 'closed',
    fn: (_) => {
      alert('VODparty: 接続が切断されました。');
    },
  },
  {
    kind: 'stop',
    fn: (_) => {
      if (vQuery != null) {
        vQuery.pause();
      }
    },
  },
  {
    kind: 'coldSeek',
    fn: (req) => {
      if (vQuery != null) {
        const rVPI = req.value as VideoPlayingInfo;
        if (rVPI.playing) {
          vQuery.currentTime = (new Date().getTime() - rVPI.ptime) / 1000;
          void vQuery.play();
        } else {
          vQuery.currentTime = rVPI.ptime / 1000;
          vQuery.pause();
        }
      }
    },
  },
  {
    kind: 'seek',
    fn: (req) => {
      if (vQuery != null) {
        vQuery.currentTime = (req.value as number[])[0] / 1000;
      }
    },
  },
  {
    kind: 'changeSpeed',
    fn: (req) => {
      if (vQuery != null) {
        const params = req.value as number[];
        const speed = params[0];
        const eTime = params[1];
        if (vQuery.playbackRate !== speed) {
          vQuery.playbackRate = speed;

          // if (speed === 1) {
          //   clearInterval(videoStateLoop);
          //   videoStateLoop = setInterval(getVideoState, VIDEO_STATE_INTERVAL_LOW);
          // } else {
          //   clearInterval(videoStateLoop);
          //   videoStateLoop = setInterval(getVideoState, VIDEO_STATE_INTERVAL_HIGH);
          // }

          if (videoSpeedChangeAfter !== 0) {
            clearTimeout(videoSpeedChangeAfter);
          }
          videoSpeedChangeAfter = setTimeout(() => {
            if (vQuery != null) {
              vQuery.playbackRate = 1;
            }
            videoSpeedChangeAfter = 0;
          }, eTime);
        }
      }
    },
  },
] as Array<{
  kind: string;
  fn: (req: AdjustMessage) => void;
}>;
