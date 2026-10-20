import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../cn';
import styles from './Tooltip.module.css';

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * A tooltip. It carries its own provider so it works anywhere in the tree.
 */
export function Tooltip({ children, delayDuration = 200, ...rest }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      <TooltipPrimitive.Root {...rest}>{children}</TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className, children, side = 'top', ...rest }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content className={cn(styles.content, className)} side={side} sideOffset={6} {...rest}>
        {children}
        <TooltipPrimitive.Arrow className={styles.arrow} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
