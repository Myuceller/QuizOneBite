'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { QuestionImage } from '../domain/question-image';
import styles from './question-illustration.module.css';

export function QuestionIllustration({ image, compact = false }: { image?: QuestionImage | null; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!image) return null;
  const picture = failed ? <span className={styles.fallback}>이미지 설명: {image.alt}</span> : <Image
    className={styles.image} src={image.src} alt={image.alt} width={image.width} height={image.height}
    unoptimized onError={() => setFailed(true)} />;
  if (compact) return <span className={styles.thumbnail}>{picture}</span>;
  return <figure className={styles.figure}>
    <div className={styles.frame}>{picture}</div>
    {failed ? <figcaption role="status">이미지를 불러오지 못했어요. 위 설명을 보고 풀어주세요.</figcaption> : <figcaption><details><summary>이미지 설명 보기</summary><p>{image.alt}</p></details></figcaption>}
  </figure>;
}
