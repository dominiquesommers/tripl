import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  notify(message: string, isError: boolean = false, undoAction?: () => void) {
    const actionLabel = undoAction ? 'Undo' : 'Close';
    const snackBarRef = this.snackBar.open(message, actionLabel, {
      duration: undoAction ? 6000 : 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: isError ? ['error-snackbar', 'glass-snackbar'] : ['glass-snackbar']
    });

    if (undoAction) {
      snackBarRef.onAction().subscribe(() => undoAction());
    }
  }
}
