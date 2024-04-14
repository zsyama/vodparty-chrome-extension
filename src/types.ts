type VideoPlayingInfo = {
  playing: boolean,
  ptime: number,
  pauseReason: number,
  url: string | undefined,
  duration: number,
};

type ResponseMessage = {
  kind: string,
  response: any,
};

type ResponseNowDate = {
  current_timestamp: number,
};

type AdjustMessage = {
  kind: string;
  value: VideoPlayingInfo | Array<number>;
};