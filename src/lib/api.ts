import type { Extraction, Health } from './types';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(80_000),
      headers: { 'X-Magam-Client': '1', ...init.headers },
    });
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new Error('응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error('서버에 연결하지 못했습니다. 네트워크와 서버 실행 상태를 확인해 주세요.');
  }
  const body = (await response.json().catch(() => null)) as T & { message?: string };
  if (!response.ok)
    throw new Error(body?.message ?? '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  if (!body) throw new Error('서버 응답을 읽을 수 없습니다. 서버 실행 상태를 확인해 주세요.');
  return body;
}

export const getHealth = () => request<Health>('/health', { signal: AbortSignal.timeout(5000) });

// Canvas applies image orientation and removes EXIF metadata before transmission.
export async function prepareImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WEBP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.');
  if (file.size > 10 * 1024 * 1024) throw new Error('사진 한 장의 크기는 10MB 이하여야 합니다.');
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.'));
      image.src = url;
    });
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리할 수 없습니다. 다른 브라우저를 이용해 주세요.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('사진 변환에 실패했습니다.'))),
        'image/jpeg',
        0.9,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractReceipt(
  file: File,
  nameMode: string,
  accessKey: string,
): Promise<Extraction> {
  const body = new FormData();
  body.append('file', await prepareImage(file), 'receipt.jpg');
  body.append('nameMode', nameMode);
  const result = await request<Extraction>('/receipts/extract', {
    method: 'POST',
    body,
    headers: accessKey ? { 'X-Access-Key': accessKey } : {},
  });
  if (!Array.isArray(result.entries) || !Array.isArray(result.warnings))
    throw new Error('인식 결과 형식이 올바르지 않습니다.');
  return result;
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some mobile browsers deny clipboard access even on HTTPS.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  const previousFocus = document.activeElement;
  // Native modal dialogs make the rest of the document inert.
  (document.querySelector('dialog[open]') ?? document.body).appendChild(textarea);
  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
  if (!copied)
    throw new Error('자동 복사가 지원되지 않습니다. 미리보기의 텍스트를 길게 눌러 복사해 주세요.');
}

export function downloadText(text: string, date: string) {
  const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Magam-Beauty-${date}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
