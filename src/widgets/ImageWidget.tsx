import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { dashboardStore } from '../state/store';
import { DraftField } from '../ui/DraftField';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { saveImage, loadMedia, saveMedia, cleanupImages } from '../assets/images';

export function ImageWidget({
  widget,
  header,
}: {
  widget: Extract<Widget, { type: 'image' | 'video' }>;
  header: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const isVideo = widget.type === 'video';
  const noun = isVideo ? 'video' : 'image';

  useEffect(() => {
    let disposed = false;
    let objectUrl = '';
    setUrl('');
    if (!widget.content.assetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    void loadMedia(widget.content.assetId)
      .then((asset) => {
        if (disposed) return;
        if (asset.blob.type.startsWith('video/') !== isVideo)
          throw Error('The saved media has the wrong format. Replace it with a new file.');
        objectUrl = URL.createObjectURL(asset.blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [widget.content.assetId, isVideo]);

  return (
    <section
      className={`widget image-card ${isVideo ? 'video-card' : ''}`}
      aria-label={widget.title || (isVideo ? 'Video' : 'Image')}
    >
      {header}
      <input
        ref={input}
        type="file"
        accept={isVideo ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (isVideo !== file.type.startsWith('video/')) {
            setError(
              isVideo ? 'Choose an MP4 or WebM video.' : 'Choose a PNG, JPEG or WebP image.',
            );
            event.target.value = '';
            return;
          }
          setBusy(true);
          setError('');
          setInfo('');
          void (isVideo ? saveMedia(file) : saveImage(file))
            .then((asset) =>
              dashboardStore.dispatch({
                type: 'imageAsset',
                widgetId: widget.id,
                expected: widget.content.assetId,
                value: asset.id,
              }),
            )
            .catch((e) => setError(e.message))
            .finally(() => {
              setBusy(false);
              if (input.current) input.current.value = '';
            });
        }}
      />
      <div className="image-body">
        {url ? (
          isVideo ? (
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              aria-label={widget.content.caption || 'Uploaded local video'}
              style={{ objectFit: widget.settings.fit }}
              onError={() =>
                setError(
                  'The saved video cannot be played. Replace it with a supported MP4 or WebM.',
                )
              }
            />
          ) : (
            <img
              src={url}
              alt={widget.content.caption || 'Uploaded local image'}
              style={{ objectFit: widget.settings.fit }}
              onError={() => setError('The saved image cannot be displayed. Replace or remove it.')}
            />
          )
        ) : (
          <div className="image-empty">
            <Icon name={isVideo ? 'play' : 'image'} />
            {loading ? (
              <p className="empty-copy" role="status">
                Loading your {noun}…
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="image-upload"
                  aria-label={`${widget.content.assetId ? 'Replace' : 'Upload'} ${noun}`}
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  {busy
                    ? 'Saving…'
                    : isVideo
                      ? 'Choose a video'
                      : widget.content.assetId
                        ? 'Choose another photo'
                        : 'Choose a photo'}
                </button>
                <p className="empty-copy">
                  {isVideo ? 'MP4 or WebM · 25 MiB · 5 min' : 'PNG, JPEG or WebP · up to 5 MiB'}
                </p>
              </>
            )}
          </div>
        )}
        <div className="image-actions">
          {url && (
            <IconButton
              icon="upload"
              disabled={busy}
              label={`${busy ? 'Saving' : 'Replace'} ${noun}`}
              onClick={() => input.current?.click()}
            />
          )}
          {widget.content.assetId && (
            <IconButton
              icon="trash"
              destructive
              label={`Remove ${noun}`}
              onClick={() => {
                void dashboardStore
                  .dispatch({
                    type: 'imageAsset',
                    widgetId: widget.id,
                    expected: widget.content.assetId,
                    value: null,
                  })
                  .catch((e) => setError(e.message));
              }}
            />
          )}
          {widget.content.assetId && (
            <select
              aria-label={isVideo ? 'Video fit' : 'Image fit'}
              value={widget.settings.fit}
              onChange={(e) => {
                void dashboardStore
                  .dispatch({
                    type: 'imageFit',
                    widgetId: widget.id,
                    expected: widget.settings.fit,
                    value: e.target.value as 'cover' | 'contain',
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              <option value="contain">Contain</option>
              <option value="cover">Crop to fill</option>
            </select>
          )}
          <IconButton
            icon="broom"
            label={isVideo ? 'Clean unused media' : 'Clean unused images'}
            className="asset-cleanup"
            onClick={() => {
              void cleanupImages()
                .then((result) =>
                  setInfo(
                    result.protectedByRecovery
                      ? 'Cleanup skipped to protect a recovery copy.'
                      : `${result.removed} unused images removed. Recent uploads are kept for 24 hours.`,
                  ),
                )
                .catch((e) => setError(e.message));
            }}
          />
        </div>
      </div>
      <div className="image-caption">
        <DraftField
          multiline
          label={isVideo ? 'Video caption' : 'Image caption'}
          maxLength={2000}
          value={widget.content.caption}
          placeholder="A little moment…"
          onSave={(expected, value) =>
            dashboardStore.dispatch({ type: 'imageCaption', widgetId: widget.id, expected, value })
          }
        />
        <span className="caption-underline" aria-hidden="true" />
      </div>
      {(error || info) && (
        <div className="image-status">
          {error && (
            <p className="local-error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="asset-info" role="status">
              {info}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
