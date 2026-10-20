import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../cn';
import styles from './Tabs.module.css';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, children, ...rest }) {
  return (
    <TabsPrimitive.List className={cn(styles.list, className)} {...rest}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ className, children, ...rest }) {
  return (
    <TabsPrimitive.Trigger className={cn(styles.trigger, className)} {...rest}>
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, children, ...rest }) {
  return (
    <TabsPrimitive.Content className={cn(styles.content, className)} {...rest}>
      {children}
    </TabsPrimitive.Content>
  );
}
