'use client';

import { BottomSheet } from '../BottomSheet';
import { CommentSheetProps } from './CommentSheet.types';
import styles from './CommentSheet.module.css';

const AVATAR_COLORS = ['#fe2c55', '#2f7cf6', '#2fb84f', '#8e44ad', '#f39c12', '#16a085'];

/** Read-only comments panel showing the comments the researcher set for this video. */
export const CommentSheet = ({ comments, onClose }: CommentSheetProps) => {
  const heading = comments.length === 1 ? '1 comment' : `${comments.length} comments`;
  return (
    <BottomSheet heading={heading} onDismiss={onClose} className={styles.tall}>
      {comments.length === 0 ? (
        <p className={styles.empty}>No comments yet</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment, i) => (
            <li key={i} className={styles.comment}>
              <span
                className={styles.avatar}
                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                aria-hidden="true"
              >
                {comment.author.charAt(0).toUpperCase()}
              </span>
              <div className={styles.body}>
                <p className={styles.author}>{comment.author}</p>
                <p className={styles.text}>{comment.text}</p>
              </div>
              {comment.likes !== undefined && <span className={styles.likes}>♥ {comment.likes}</span>}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
    </BottomSheet>
  );
};
