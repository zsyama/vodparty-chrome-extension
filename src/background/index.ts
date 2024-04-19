import { qpList, PauseReason } from '../consts';

// const ROOM_LEADER = true;
const SEEK_LOOKAHEAD_MSEC = 300;
const SEEK_BORDER_MSEC = 3000;
const ADJUST_BORDER_MSEC = 100;
const ADJUST_SPEED_EFFECT_RATE = 0.15;

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_ORIGIN;

let roomLeader = false;
const wsEndpoint = import.meta.env.VITE_WEBSOCKET_ENDPOINT;

let socket: WebSocket;
let timeCorrection = 0;

let clientTabId: number | undefined;
let clientVPI: VideoPlayingInfo | undefined;
let leaderVPI: VideoPlayingInfo | undefined;

let wsTimer: number | undefined;

const wsRecvFunctions = [
  {
    kind: 'getNow',
    fn: (_: WebSocket, data: ResponseMessage) => {
      const cDate = (data.response as ResponseNowDate).current_timestamp;
      timeCorrection = (new Date().getTime() - cDate);
      console.log(`Time correction: ${timeCorrection}`);
    },
  },
  {
    kind: 'videoStateChanged',
    fn: (_: WebSocket, data: ResponseMessage) => {
      void videoStateUpdate(data.response as VideoPlayingInfo);
    },
  },
  {
    kind: 'browserLogin',
    fn: (_: WebSocket, data: ResponseMessage) => {
      void (async () => {
        roomLeader = data.response.leader;
        if (clientTabId == null) {
          return;
        }

        if (data.response.currentVPI?.url != null) {
          void videoStateUpdate(data.response.currentVPI as VideoPlayingInfo);
        } else {
          void chrome.tabs.update(clientTabId, {
            url: 'chrome://newtab/',
          });
        }

        console.log(`partyStart TabId:${clientTabId} Leader:${roomLeader}`);
      })();
    },
  },
  {
    kind: 'changeLeader',
    fn: (_: WebSocket, data: ResponseMessage) => {
      roomLeader = data.response.leader;
      console.log(`partyModified TabId:${clientTabId} Leader:${roomLeader}`);
    },
  },
] as Array<{
  kind: string;
  fn: (socket: WebSocket, data: ResponseMessage) => void;
}>;

async function videoStateUpdate (rVPI: VideoPlayingInfo): Promise<void> {
  // if (!roomLeader) {
  if (rVPI.playing) {
    rVPI.ptime += timeCorrection;
  }
  leaderVPI = rVPI;

  if (clientTabId == null) {
    return;
  }

  if (leaderVPI.url != null) {
    if (clientVPI?.url == null) {
      await chrome.tabs.update(clientTabId, {
        url: leaderVPI.url,
      });
      return;
    }

    const leaderURL = new URL(leaderVPI.url);
    const clientURL = new URL(clientVPI.url);
    if (leaderURL.origin !== clientURL.origin || leaderURL.pathname !== clientURL.pathname) {
      await chrome.tabs.update(clientTabId, {
        url: leaderVPI.url,
      });
      return;
    } else if (
      leaderURL.origin + leaderURL.pathname === 'https://www.youtube.com/watch' &&
      leaderURL.searchParams.get('v') !== clientURL.searchParams.get('v')
    ) {
      await chrome.tabs.update(clientTabId, {
        url: leaderVPI.url,
      });
      return;
    }
  }

  const p = adjustVideoCurrentTime();
  p.catch((e) => { console.log(e) });
  // }
}

async function initWebsocket (): Promise<void> {
  // roomLeader = ROOM_LEADER;
  let pResolve: (value: unknown) => void;
  const waitingOpen = new Promise(resolve => { pResolve = resolve; });

  socket = new WebSocket(wsEndpoint);
  socket.onopen = () => {
    console.log('ws connected');
    socket.send(JSON.stringify({ kind: 'getNow' }));

    if (wsTimer != null) {
      clearInterval(wsTimer);
    }
    wsTimer = setInterval(() => { socket.send(JSON.stringify({ kind: 'ping' })) }, 10000);
    pResolve(0);
  };

  socket.onmessage = (ev: MessageEvent<string>) => {
    try {
      const jData = JSON.parse(ev.data);
      const res = jData as ResponseMessage;
      const fn = wsRecvFunctions.find((x) => x.kind === res.kind)?.fn;

      if (fn != null) {
        fn(socket, res);
      }
    } catch {
      console.log('Unknown data received');
      socket.close();
    }
  };

  socket.onclose = () => {
    console.log('ws disconnected');
    clearInterval(wsTimer);
    wsTimer = undefined;

    if (clientTabId != null) {
      void chrome.tabs.sendMessage(clientTabId, {
        kind: 'closed',
      });
    }
  };

  await waitingOpen;
}

async function adjustVideoCurrentTime (): Promise<void> {
  if (clientVPI == null || leaderVPI == null || clientVPI.duration !== leaderVPI.duration) {
    // deSyncしていることを送信
    socket.send(JSON.stringify({
      kind: 'SyncStateChanged',
      value: { state: 2 },
    }));
    return;
  }

  if (clientTabId == null) {
    return;
  }

  if (!leaderVPI.playing && Math.floor(leaderVPI.duration * 1000) <= leaderVPI.ptime) {
    await chrome.tabs.sendMessage(clientTabId, {
      kind: 'stop',
    });

    // Syncしていることを送信
    socket.send(JSON.stringify({
      kind: 'SyncStateChanged',
      value: { state: 0 },
    }));
  } else if (!leaderVPI.playing || !clientVPI.playing) {
    await chrome.tabs.sendMessage(clientTabId, {
      kind: 'coldSeek',
      value: leaderVPI,
    });

    // Syncしていることを送信
    socket.send(JSON.stringify({
      kind: 'SyncStateChanged',
      value: { state: 0 },
    }));
  } else {
    const offsetMSec = Math.abs(leaderVPI.ptime - clientVPI.ptime);
    if (offsetMSec > SEEK_BORDER_MSEC) {
      await chrome.tabs.sendMessage(clientTabId, {
        kind: 'seek',
        value: [SEEK_LOOKAHEAD_MSEC + new Date().getTime() - leaderVPI.ptime],
      } satisfies AdjustMessage);

      // Syncしていることを送信
      socket.send(JSON.stringify({
        kind: 'SyncStateChanged',
        value: { state: 0 },
      }));
    } else if (offsetMSec > ADJUST_BORDER_MSEC) {
      if (leaderVPI.ptime > clientVPI.ptime) {
        await chrome.tabs.sendMessage(clientTabId, {
          kind: 'changeSpeed',
          value: [1 - ADJUST_SPEED_EFFECT_RATE, (leaderVPI.ptime - clientVPI.ptime) / ADJUST_SPEED_EFFECT_RATE],
        } satisfies AdjustMessage);
      } else {
        await chrome.tabs.sendMessage(clientTabId, {
          kind: 'changeSpeed',
          value: [1 + ADJUST_SPEED_EFFECT_RATE, (clientVPI.ptime - leaderVPI.ptime) / ADJUST_SPEED_EFFECT_RATE],
        } satisfies AdjustMessage);
      }

      // Syncingであることを送信
      socket.send(JSON.stringify({
        kind: 'SyncStateChanged',
        value: { state: 1 },
      }));
    } else {
      // Syncしていることを送信
      socket.send(JSON.stringify({
        kind: 'SyncStateChanged',
        value: { state: 0 },
      }));
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  console.log(JSON.stringify(message));

  if (message.partyStart != null) {
    if (sender.tab?.id != null) {
      clientTabId = sender.tab.id;
      roomLeader = message.partyStart;
      console.log(`partyStart TabId:${clientTabId} Leader:${roomLeader}`);
      return true;
    } else {
      return false;
    }
  }

  clientVPI = message as VideoPlayingInfo;

  if (sender.tab != null && sender.tab.id === clientTabId) {
    if (roomLeader) {
      const sendData = clientVPI;
      sendData.ptime = sendData.ptime - timeCorrection;
      socket.send(JSON.stringify({
        kind: 'videoStateChanged',
        value: sendData,
      }));

      socket.send(JSON.stringify({
        kind: 'SyncStateChanged',
        value: { state: 0 },
      }));
    } else {
      const p = adjustVideoCurrentTime();
      p.catch((e) => { console.log(e) });
    }
  }

  return true; // trueを返す。
});

chrome.tabs.onUpdated.addListener((tabId, _, tab) => {
  void (async () => {
    if (tab.url == null) return;
    const url = new URL(tab.url);
    if (url.origin === SERVER_ORIGIN && clientTabId !== tabId) {
      const sessionId = url.searchParams.get('s');
      if (sessionId != null) {
        clientTabId = tabId;
        if (socket.readyState > 1) {
          await initWebsocket();
        }
        socket.send(JSON.stringify({
          kind: 'browserLogin',
          value: { sessionId },
        }));
      }
    } else if (
      clientTabId === tabId &&
      roomLeader &&
      clientVPI?.playing === true &&
      clientVPI.url !== tab.url &&
      qpList.findIndex((x) => x.url === url.origin + url.pathname) < 0
    ) {
      console.log({
        clientVPI, url: tab.url, roomLeader
      });

      clientVPI.playing = false;
      clientVPI.pauseReason = PauseReason.userInteraction;
      clientVPI.ptime = new Date().getTime() - clientVPI.ptime;

      const sendData = clientVPI;
      sendData.ptime = sendData.ptime - timeCorrection;
      socket.send(JSON.stringify({
        kind: 'videoStateChanged',
        value: sendData,
      }));

      socket.send(JSON.stringify({
        kind: 'SyncStateChanged',
        value: { state: 2 },
      }));
    }
  })();
});

chrome.tabs.onRemoved.addListener((tabId, _) => {
  if (tabId === clientTabId) {
    socket.send(JSON.stringify({
      kind: 'browserClose',
      value: {},
    }));
    clientVPI = undefined;
    clientTabId = undefined;
  }
});

void initWebsocket();

/*
{
  const yt_env = {urlpattern: /^https:\/\/www\.youtube\.com\/watch\?v=/};

  chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;
    // Enables the side panel on google.com
    if (yt_env.urlpattern.test(tab.url)) {
      tab.
    }
  });
}
*/
