export const qpList = [
  {
    url: 'https://www.youtube.com/watch',
    vqPath: 'video.video-stream.html5-main-video',
    isAdvertise: (): boolean => {
      return document.querySelector('#movie_player > div.video-ads.ytp-ad-module > div') != null;
    },
  },
  {
    url: 'https://animestore.docomo.ne.jp/animestore/sc_d_pc',
    vqPath: 'video#video',
    isAdvertise: (): boolean => false,
  }
] as const;

export const enum PauseReason {
  none = 0,
  buffering = 1,
  userInteraction = 2,
  advertisement = 3,
};
