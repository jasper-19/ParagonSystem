export interface ErrorStatus {
  code: string;
  label: string;
  title: string;
  message: string;
  retry: boolean;
}

const messages: Record<number, [string, string, string]> = {
  400: ['Bad request', 'Something needs a second look.', 'This request could not be understood. Check the details and try again.'],
  401: ['Sign in required', 'Your session needs a fresh start.', 'Sign in to continue to this part of the publication.'],
  403: ['Access restricted', 'This page is behind the desk.', 'Your account does not have permission to view this content. Contact your administrator if you need access.'],
  404: ['Page not found', 'This page missed the edition.', 'The link may have changed, or this story is no longer available. There is still plenty to discover.'],
  405: ['Method not allowed', 'This request took a wrong turn.', 'This action is not available here. Return to the publication and try from there.'],
  408: ['Request timeout', 'We lost the thread.', 'The request took too long to arrive. Check your connection and try again.'],
  409: ['Conflicting changes', 'Another edit got here first.', 'The content has changed since you opened it. Keep a copy of your work, then reload the latest version.'],
  410: ['Content removed', 'This chapter has closed.', 'This content is no longer available. Explore the latest stories or visit our publication library.'],
  413: ['File too large', 'A little too much for this edition.', 'The upload exceeds the allowed size. Choose a smaller file and submit it again.'],
  415: ['Unsupported file type', 'A different format is needed.', 'This file format is not supported. Choose an accepted format and try again.'],
  416: ['Range unavailable', 'That part could not be opened.', 'The requested section of this publication is unavailable. Reopen the publication to load its latest version.'],
  422: ['Invalid details', 'A few details need attention.', 'Check the information you entered and correct any highlighted fields before submitting again.'],
  429: ['Too many requests', 'Let’s take a brief pause.', 'Several requests arrived at once. Wait a little before trying again.'],
  500: ['Server error', 'A pause in the press.', 'Something went wrong while preparing this page. Please try again in a moment.'],
  501: ['Not supported', 'This action is not available yet.', 'The service cannot complete this type of request. Return to the publication to continue browsing.'],
  502: ['Gateway error', 'The next page is out of reach.', 'We could not get a response from a service we depend on. Please try again shortly.'],
  503: ['Service unavailable', 'The press is taking a breather.', 'This service is temporarily unavailable. Please give it a moment and try again.'],
  504: ['Gateway timeout', 'This edition is taking longer.', 'A service took too long to respond. Please try again shortly.'],
};

export function getErrorStatus(value: string | number | null | undefined): ErrorStatus {
  if (value === 0 || value === '0' || value === 'offline') {
    return { code: 'OFFLINE', label: 'Connection unavailable', title: 'We couldn’t make the connection.', message: 'Check your internet connection and try again. The service may also be temporarily unreachable.', retry: true };
  }
  const status = Number(value);
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    return { code: 'ERROR', label: 'Something went wrong', title: 'A pause in the story.', message: 'This page could not be loaded. Please try again or return to the publication.', retry: true };
  }
  const [label, title, message] = messages[status] ?? (status >= 500
    ? ['Service error', 'A pause in the press.', 'The service could not complete this request. Please try again later.']
    : ['Request unavailable', 'This request could not be completed.', 'Return to the publication and check the details before trying again.']);
  return { code: String(status), label, title, message, retry: [408, 429, 500, 502, 503, 504].includes(status) };
}
