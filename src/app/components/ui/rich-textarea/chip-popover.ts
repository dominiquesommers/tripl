// import {
//   Component, input, output, signal, ViewChild,
//   ElementRef, AfterViewInit, OnInit
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { LucideAngularModule } from 'lucide-angular';
// import { PatternType, PATTERN_CONFIG } from './rich-textarea';
//
// @Component({
//   selector: 'app-chip-popover',
//   standalone: true,
//   imports: [CommonModule, LucideAngularModule],
//   template: `
//     <div class="chip-popover bubble-dropdown" data-rich-popover>
//       <div class="popover-field">
//         <lucide-icon [name]="config[type()].icon" [size]="14" [style.color]="config[type()].color"></lucide-icon>
//         <input #hiddenInput
//                type="text"
//                class="popover-input"
//                [placeholder]="config[type()].placeholder"
//                [value]="hidden()"
//                (input)="hidden.set($any($event.target).value)"
//                (keydown)="onKeyDown($event)"
//                (blur)="onConfirm()" />
//       </div>
//     </div>
//   `,
// })
// export class ChipPopover implements OnInit, AfterViewInit {
//
//   config = PATTERN_CONFIG;
//
//   type = input.required<PatternType>();
//   initialHidden = input<string>('');
//
//   confirm = output<{ hidden: string }>();
//   close = output<void>();
//
//   hidden = signal('');
//
//   @ViewChild('hiddenInput') hiddenInput!: ElementRef<HTMLInputElement>;
//
//   ngOnInit() {
//     this.hidden.set(this.initialHidden());
//   }
//
//   ngAfterViewInit() {
//     setTimeout(() => this.hiddenInput?.nativeElement.focus(), 0);
//   }
//
//   onConfirm() {
//     const hidden = this.hidden().trim();
//     if (!hidden) {
//       this.close.emit();
//       return;
//     }
//     this.confirm.emit({ hidden });
//   }
//
//   onKeyDown(event: KeyboardEvent) {
//     if (event.key === 'Enter') {
//       event.preventDefault();
//       this.onConfirm();
//     }
//     if (event.key === 'Escape') {
//       event.preventDefault();
//       this.close.emit();
//     }
//   }
// }
