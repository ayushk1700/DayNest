import type { MusicAction, MusicState, MusicTrack } from '../music/types';
(() => {
  const scope = globalThis as typeof globalThis & { __daynestMusicConnectorLoaded?: boolean };
  if (scope.__daynestMusicConnectorLoaded) return;
  scope.__daynestMusicConnectorLoaded = true;
  interface Runtime {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          respond: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  }
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: Runtime } }).chrome
    ?.runtime;
  const firstText = (selectors: string[]) =>
    selectors
      .map((selector) => document.querySelector(selector)?.textContent?.trim() ?? '')
      .find(Boolean) ?? '';
  const labels = (element: Element | null) =>
    `${element?.getAttribute('aria-label') ?? ''} ${element?.getAttribute('title') ?? ''}`
      .trim()
      .toLowerCase();
  function highResolutionArtwork(url: string | undefined) {
    if (!url) return undefined;
    return url.replace(/=w\d+-h\d+[^&]*/i, '=w1600-h1600-l90-rj').replace(/=s\d+$/i, '=s1600');
  }
  function bestArtwork() {
    const image = document.querySelector<HTMLImageElement>(
      'ytmusic-player-bar img#img, ytmusic-player-bar img',
    );
    const candidates = (image?.srcset || '')
      .split(',')
      .map((candidate) => {
        const [url, descriptor] = candidate.trim().split(/\s+/);
        const value = Number.parseFloat(descriptor || '1');
        const score = descriptor?.endsWith('w') ? value : value * (image?.naturalWidth || 1000);
        return { url, score };
      })
      .filter((candidate) => candidate.url && /^https?:/i.test(candidate.url));
    const largest = candidates.sort((a, b) => b.score - a.score)[0]?.url;
    const source =
      largest ||
      image?.currentSrc ||
      image?.src ||
      document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
    return highResolutionArtwork(source);
  }
  function control(action: MusicAction): HTMLElement | null {
    const buttons = [
      ...document.querySelectorAll<HTMLElement>(
        'ytmusic-player-bar button, ytmusic-player-bar tp-yt-paper-icon-button, ytmusic-player-bar [role="button"]',
      ),
    ];
    return (
      buttons.find((button) => {
        const name = labels(button);
        if (action === 'toggle') return name.includes('pause') || name.includes('play');
        if (action === 'next') return name.includes('next');
        return name.includes('previous') || name.includes('prev');
      }) ?? null
    );
  }
  function snapshot(): MusicState {
    const pageTitle = document.title.replace(/\s*[-|–]\s*YouTube Music\s*$/i, '').trim();
    const title =
      firstText(['ytmusic-player-bar .title', 'ytmusic-player-bar [slot="title"]']) ||
      (/^youtube music$/i.test(pageTitle) ? '' : pageTitle);
    const byline = firstText([
      'ytmusic-player-bar .byline',
      'ytmusic-player-bar #subtitle',
      'ytmusic-player-bar [class*="byline"]',
    ]);
    const pieces = byline
      .split('•')
      .map((value) => value.trim())
      .filter(Boolean);
    const artist =
      pieces[0] ||
      document.querySelector<HTMLMetaElement>('meta[name="music:musician"]')?.content?.trim();
    const album = pieces.length > 1 ? pieces.at(-1) : undefined;
    const artwork = bestArtwork();
    const video = document.querySelector('video');
    const videoId = new URL(location.href).searchParams.get('v') || undefined;
    const playControl = control('toggle');
    const label = labels(playControl);
    const track: MusicTrack | null = title
      ? {
          title,
          ...(artist ? { artist } : {}),
          ...(album ? { album } : {}),
          ...(artwork ? { artworkUrl: artwork } : {}),
          ...(videoId ? { videoId } : {}),
          ...(video && Number.isFinite(video.duration)
            ? { durationSeconds: video.duration, currentTimeSeconds: video.currentTime }
            : {}),
        }
      : null;
    return {
      status: track ? 'connected' : 'connecting',
      track,
      isPlaying: label.includes('pause') || (!!video && !video.paused),
    };
  }
  function clickControl(action: MusicAction): boolean {
    const button = control(action);
    if (
      !button ||
      button.hasAttribute('disabled') ||
      button.getAttribute('aria-disabled') === 'true'
    )
      return false;
    button.click();
    return true;
  }
  runtime?.onMessage.addListener((message, _sender, respond) => {
    if (!message || typeof message !== 'object') return;
    const request = message as { type?: string; action?: MusicAction };
    if (request.type === 'music:read') {
      respond(snapshot());
      return;
    }
    const playRequest = message as { type?: string; videoId?: string };
    if (
      playRequest.type === 'music:playTrack' &&
      /^[a-zA-Z0-9_-]{6,}$/.test(playRequest.videoId || '')
    ) {
      const target = new URL('/watch', location.origin);
      target.searchParams.set('v', playRequest.videoId!);
      respond({ ok: true });
      window.setTimeout(() => location.assign(target.href), 60);
      return;
    }
    if (
      request.type === 'music:control' &&
      ['toggle', 'next', 'previous'].includes(String(request.action))
    ) {
      respond({ ok: clickControl(request.action!) });
      return;
    }
  });
})();
