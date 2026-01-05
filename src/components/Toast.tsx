import { useEffect, useState } from "react";
import * as styles from "./Toast.css";

export type ToastType = "info" | "success" | "warning" | "error";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles: Record<ToastType, string> = {
    info: styles.toastInfo,
    success: styles.toastSuccess,
    warning: styles.toastWarning,
    error: styles.toastError,
  };

  return (
    <div className={`${styles.toast} ${typeStyles[type]} ${isVisible ? styles.toastVisible : styles.toastHidden}`}>
      <span className={styles.toastMessage}>{message}</span>
      <button className={styles.toastClose} onClick={() => { setIsVisible(false); setTimeout(onClose, 200); }}>
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
