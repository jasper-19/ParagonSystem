declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings?: any);

    loadFromHTML(pages: HTMLElement[]): void;
    on(eventName: string, callback: (e: any) => void): void;

    flip(pageIndex: number): void;
    flipNext(): void;
    flipPrev(): void;

    destroy(): void;
  }
}

