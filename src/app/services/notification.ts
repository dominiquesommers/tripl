import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/ui/confirm-dialog/confirm-dialog';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  notify(message: string, isError: boolean = false, undoAction?: () => void) {
    const actionLabel = undoAction ? 'Undo' : 'Close';
    const snackBarRef = this.snackBar.open(message, actionLabel, {
      duration: undoAction ? 6000 : 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: isError ? ['error-snackbar', 'glass-snackbar'] : ['glass-snackbar']
    });

    if (undoAction) {
      snackBarRef.onAction().pipe(take(1)).subscribe(() => undoAction());
    }
  }

  // TIER 3: SnackBar Confirm (Non-blocking, requires click to execute)
  confirmSnackBar(options: {
    message: string;
    actionLabel?: string;
    onConfirm: () => void;
  }) {
    const snackBarRef = this.snackBar.open(
      options.message,
      options.actionLabel ?? 'Confirm',
      {
        duration: 8000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
        panelClass: ['glass-snackbar', 'confirm-snackbar']
      }
    );

    snackBarRef.onAction().pipe(take(1)).subscribe(() => options.onConfirm());
  }

  // TIER 4: Blocking Modal Confirm (For hard deletes & cascading data removal)
  confirmModal(data: ConfirmDialogData, onConfirm: () => void) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data,
      panelClass: 'top-toast-panel',
      backdropClass: 'top-toast-backdrop',
      position: { top: '12px' },
      hasBackdrop: true,
      disableClose: false
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((confirmed: boolean) => {
      if (confirmed) {
        onConfirm();
      }
    });
  }
}
