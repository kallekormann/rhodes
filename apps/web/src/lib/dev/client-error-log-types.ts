export type ClientErrorEntry = {
  id: string;
  at: string;
  message: string;
  stack?: string;
  source?: string;
  url?: string;
  online: boolean;
};
