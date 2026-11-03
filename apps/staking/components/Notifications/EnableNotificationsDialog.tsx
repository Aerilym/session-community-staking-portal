import { ButtonDataTestId } from '@/testing/data-test-ids';
import { Button } from '@session/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@session/ui/ui/dialog';
import { useTranslations } from 'next-intl';

export function EnableNotificationsDialog({
  address,
  open,
  busy,
  onEnable,
  onDismiss,
}: {
  address: string | undefined;
  open: boolean;
  busy: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  const dict = useTranslations('notifications.dialog');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss()}>
      <DialogContent hideCloseButton className="bg-session-black text-session-white">
        <DialogHeader>
          <DialogTitle>{dict('title')}</DialogTitle>
          <DialogDescription className="text-session-white">
            {dict('description', { address: address ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-xs leading-relaxed">{dict('privacyNotice')}</p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            aria-label={dict('enable')}
            data-testid={ButtonDataTestId.Enable_Notifications}
            variant="outline"
            onClick={onEnable}
            disabled={busy}
          >
            {dict('enable')}
          </Button>
          <Button
            aria-label={dict('notNow')}
            data-testid={ButtonDataTestId.Dismiss_Notifications}
            variant="ghost"
            onClick={onDismiss}
            disabled={busy}
          >
            {dict('notNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
