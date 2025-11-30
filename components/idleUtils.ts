export type IdleTaskHandle = number;

type IdleCallback = (deadline: IdleDeadline) => void;

type IdleScheduler = (callback: IdleCallback, options?: IdleRequestOptions) => IdleTaskHandle;

type IdleCanceler = (handle: IdleTaskHandle) => void;

const requestIdle: IdleScheduler | undefined =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (window.requestIdleCallback as IdleScheduler)
    : undefined;

const cancelIdle: IdleCanceler | undefined =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? (window.cancelIdleCallback as IdleCanceler)
    : undefined;

export const scheduleIdleTask = (task: () => void, timeout = 300): IdleTaskHandle => {
  if (requestIdle) {
    return requestIdle(() => task(), { timeout });
  }
  return window.setTimeout(task, timeout);
};

export const cancelIdleTask = (handle: IdleTaskHandle) => {
  if (cancelIdle) {
    cancelIdle(handle);
  } else {
    window.clearTimeout(handle);
  }
};
