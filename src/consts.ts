export const qpList = [
  {
    url: 'https://www.youtube.com/watch',
    vqPath: 'video.video-stream.html5-main-video',
  },
  {
    url: 'https://animestore.docomo.ne.jp/animestore/sc_d_pc',
    vqPath: 'video#video',
  }
] as const;

export const enum PauseReason {
  none = 0,
  buffering = 1,
  userInteraction = 2,
};
