'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import type { QuestionImage } from '../domain/question-image';
import styles from './question-illustration.module.css';

export function QuestionIllustration({ image, compact = false }: { image?: QuestionImage | null; compact?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const zoomFrame = useRef<HTMLDivElement>(null);
  if (!image) return null;
  const failed = failedSrc === image.src;
  const picture = failed ? <span className={styles.fallback}>이미지 설명: {image.alt}</span> : <Image
    className={styles.image} src={image.src} alt={image.alt} width={image.width} height={image.height}
    unoptimized onError={() => setFailedSrc(image.src)} />;
  if (compact) return <span className={styles.thumbnail}>{picture}</span>;
  return <figure className={styles.figure}>
    <div className={styles.frame}>{picture}</div>
    {!failed && <>
      <button type="button" className={styles.expand} onClick={() => {
        dialog.current?.showModal();
        if (zoomFrame.current) zoomFrame.current.scrollLeft = (zoomFrame.current.scrollWidth - zoomFrame.current.clientWidth) / 2;
      }}>이미지 크게 보기</button>
      <dialog ref={dialog} className={styles.dialog} aria-label="문제 이미지 확대" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className={styles.dialogHeader}><span>문제 이미지</span><button type="button" autoFocus onClick={() => dialog.current?.close()}>닫기</button></div>
        <p className={styles.panHint}>이미지를 좌우로 밀어 살펴보세요.</p>
        <div ref={zoomFrame} className={styles.zoomFrame} tabIndex={0} aria-label="확대 이미지. 작은 화면에서는 가로로 스크롤할 수 있어요.">
          <Image src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized className={styles.zoomImage} />
        </div>
      </dialog>
    </>}
    {failed ? <figcaption role="status">이미지를 불러오지 못했어요. 위 설명을 보고 풀어주세요.</figcaption> : <figcaption><details><summary>이미지 설명 보기</summary><p>{image.alt}</p></details></figcaption>}
  </figure>;
}
