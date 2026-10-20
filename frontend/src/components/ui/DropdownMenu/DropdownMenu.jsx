import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '../cn';
import styles from './DropdownMenu.module.css';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;

export function DropdownMenuContent({ className, children, align = 'end', ...rest }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content className={cn(styles.content, className)} align={align} sideOffset={6} {...rest}>
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, children, ...rest }) {
  return (
    <DropdownMenuPrimitive.Item className={cn(styles.item, className)} {...rest}>
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...rest }) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn(styles.item, className)} checked={checked} {...rest}>
      <span className={styles.check} aria-hidden="true">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check size={14} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
