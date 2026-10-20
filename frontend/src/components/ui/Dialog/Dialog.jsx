import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../cn';
import styles from './Dialog.module.css';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ title, description, children, footer, className, ...rest }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={styles.overlay} />
      <DialogPrimitive.Content className={cn(styles.content, className)} {...rest}>
        <div className={styles.header}>
          <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className={styles.close} aria-label="Close dialog">
            <X size={16} aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        <DialogPrimitive.Description className={cn(styles.description, !description && styles.visuallyHidden)}>
          {description ?? ''}
        </DialogPrimitive.Description>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
