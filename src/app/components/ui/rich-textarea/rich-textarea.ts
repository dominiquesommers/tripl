import {
  Component, input, output, signal, computed,
  ElementRef, ViewChild, HostListener, ViewEncapsulation, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChipPopover } from './chip-popover';
import { PopupService } from '../../../services/popup';

export type PatternType = 'url' | 'maps' | 'email' | 'whatsapp';

export const PATTERN_CONFIG: Record<PatternType, {
  icon: string; color: string;
  placeholder: string; defaultLabel: string; shortcut: string;
}> = {
  url:      { icon: 'link',           color: '#60a5fa', placeholder: 'https://',          defaultLabel: 'link',     shortcut: '⌘K'  },
  maps:     { icon: 'map-pin',        color: '#34d399', placeholder: 'maps.app.goo.gl/…', defaultLabel: 'map pin',  shortcut: '⌘⇧M' },
  email:    { icon: 'mail',           color: '#f59e0b', placeholder: 'name@example.com',  defaultLabel: 'email',    shortcut: '⌘⇧E' },
  whatsapp: { icon: 'message-circle', color: '#4ade80', placeholder: '+31 6 12345678',    defaultLabel: 'whatsapp', shortcut: '⌘⇧W' },
};

const makePatternRe = () => /(url|maps|email|whatsapp)\(([^)]+),\s*([^)]*)\)/g;

@Component({
  selector: 'app-rich-textarea',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './rich-textarea.html',
  styleUrls: ['./rich-textarea.css'],
})
export class RichTextarea {

  private sanitizer = inject(DomSanitizer);
  private popupSvc = inject(PopupService);

  // ── Inputs / Outputs ──────────────────────────────────────
  value = input<string>('');
  placeholder = input<string>('Add description...');
  multiline = input<boolean>(true);
  saveValue = output<string>();

  // ── State ─────────────────────────────────────────────────
  isFocused = signal(false);
  private savedRange: Range | null = null;
  private editingChipElement: HTMLElement | null = null;

  // ── Refs ──────────────────────────────────────────────────
  @ViewChild('editor') editorEl!: ElementRef<HTMLDivElement>;
  @ViewChild('wrapper') wrapperEl!: ElementRef<HTMLDivElement>;

  patternTypes: PatternType[] = ['url', 'maps', 'email', 'whatsapp'];
  config = PATTERN_CONFIG;

  // ── Display ───────────────────────────────────────────────
  displayHtml = computed((): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(this.renderToHtml(this.value()))
  );

  hasContent = computed(() => !!this.value()?.trim());

  // ── Focus / Blur ──────────────────────────────────────────

  onEditorFocus() {
    if (!this.isFocused()) {
      this.isFocused.set(true);
      setTimeout(() => {
        if (this.editorEl) {
          this.editorEl.nativeElement.innerHTML = this.renderToEditorHtml(this.value());
          this.placeCursorAtEnd();
        }
      }, 0);
    }
  }

  onEditorBlur(event: FocusEvent) {
    if (this.popupSvc.isOpen()) {
      return;
    }

    const related = event.relatedTarget as HTMLElement;
    if (related?.closest('[data-rich-popover]')) return;

    setTimeout(() => {
      if (!this.popupSvc.isOpen()) {
        this.isFocused.set(false);
        const raw = this.serializeEditor();
        this.saveValue.emit(raw.trimEnd());
      }
    }, 150);
  }

  // ── Keyboard ──────────────────────────────────────────────

  onKeyDown(event: KeyboardEvent) {
    const meta = event.metaKey || event.ctrlKey;
    const shift = event.shiftKey;

    // Blur on Enter (single-line) or Shift+Enter (both modes)
    if (event.key === 'Enter' && (shift || !this.multiline())) {
      event.preventDefault();
      this.editorEl.nativeElement.blur();
      return;
    }

    if (meta && !shift && event.key === 'k') { event.preventDefault(); this.insertChipAndOpenPopover('url'); }
    if (meta && shift && event.key === 'M') { event.preventDefault(); this.insertChipAndOpenPopover('maps'); }
    if (meta && shift && event.key === 'E') { event.preventDefault(); this.insertChipAndOpenPopover('email'); }
    if (meta && shift && event.key === 'W') { event.preventDefault(); this.insertChipAndOpenPopover('whatsapp'); }
  }

  // ── Toolbar ───────────────────────────────────────────────

  onToolbarClick(type: PatternType, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setTimeout(() => this.insertChipAndOpenPopover(type), 100);
  }

  // ── Chip click (edit hidden value) ──────────────────────

  onChipClick(event: MouseEvent) {
    const chip = (event.target as HTMLElement).closest('[data-chip]') as HTMLElement;
    if (!chip || !this.isFocused()) return;

    event.preventDefault();
    event.stopPropagation();

    this.editingChipElement = chip;
    const type = chip.dataset['chipType'] as PatternType;
    const hidden = chip.dataset['chipHidden'] ?? '';

    this.openChipPopover(type, hidden, chip, event);
  }

  // ── Chip Popover (edit hidden value) ───────────────────────

  private openChipPopover(type: PatternType, hidden: string, chipEl: HTMLElement, event: MouseEvent) {
    this.popupSvc.open(ChipPopover, {
      position: { top: event.clientY + 6, left: event.clientX },
      inputs: {
        type,
        initialHidden: hidden,
      },
      outputs: {
        confirm: ({ hidden: newHidden }: { hidden: string }) => {
          // Clean commas from URL
          const cleanHidden = newHidden.replace(/,/g, '').trim();
          if (cleanHidden) {
            chipEl.dataset['chipHidden'] = cleanHidden;
            chipEl.dataset['pattern'] = this.buildPatternString(type, cleanHidden, chipEl.dataset['chipLabel'] ?? '');
          }
          this.popupSvc.close();
          this.editorEl?.nativeElement.focus();
          this.editingChipElement = null;
        },
        close: () => {
          this.popupSvc.close();
          this.editorEl?.nativeElement.focus();
          this.editingChipElement = null;
        },
      },
    });
  }

  // ── Insert Chip & Open Popover ─────────────────────────────

  private insertChipAndOpenPopover(type: PatternType) {
    const sel = window.getSelection();
    let label = this.config[type].defaultLabel;

    // If text is selected, use it as the label
    if (sel && !sel.isCollapsed) {
      label = sel.toString();
    }

    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }

    const chipEl = this.buildChipElement(type, '', label);

    const coords = this.getCaretCoordinates();
    if (!coords) return;

    // Insert chip at cursor (replaces selection if any)
    if (this.savedRange) {
      this.savedRange.deleteContents();
      this.savedRange.insertNode(chipEl);
      const range = document.createRange();
      range.setStartAfter(chipEl);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      this.editorEl.nativeElement.appendChild(chipEl);
    }
    this.savedRange = null;

    // Open popover to edit hidden value
    setTimeout(() => {
      this.editingChipElement = chipEl;
      this.openChipPopover(type, '', chipEl, new MouseEvent('click', {
        clientX: coords.left,
        clientY: coords.top,
      }));
    }, 0);
  }

  // ── Build Chip Element ─────────────────────────────────────

  private buildChipElement(type: PatternType, hidden: string, label: string): HTMLElement {
    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.className = `chip chip-${type}`;
    span.dataset['chip'] = 'true';
    span.dataset['chipType'] = type;
    span.dataset['chipHidden'] = hidden;
    span.dataset['chipLabel'] = label;
    span.dataset['pattern'] = this.buildPatternString(type, hidden, label);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'chip-label';
    labelSpan.contentEditable = 'true';
    labelSpan.textContent = label;

    // When label text changes (during typing)
    labelSpan.addEventListener('input', () => {
      const newLabel = labelSpan.textContent ?? '';
      span.dataset['chipLabel'] = newLabel;
      span.dataset['pattern'] = this.buildPatternString(type, hidden, newLabel);
    });

    // Handle backspace/delete to remove chip only when label is completely empty
    labelSpan.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && labelSpan.textContent === '') {
        e.preventDefault();
        span.remove();
        this.editorEl.nativeElement.focus();
      }
    });

    // Prevent chip click from triggering normal click handler
    labelSpan.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Open popover when clicking on the chip itself (not the label text)
    span.addEventListener('click', (e) => {
      if (e.target === labelSpan) return; // Don't open popover if clicking label text
      e.stopPropagation();
      this.onChipClick(e as any);
    });

    span.appendChild(labelSpan);
    return span;
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildPatternString(type: PatternType, hidden: string, label: string): string {
    return `${type}(${hidden}, ${label})`;
  }

  // ── Serialization ──────────────────────────────────────────

  serializeEditor(): string {
    if (!this.editorEl) return this.value();
    let result = '';
    this.editorEl.nativeElement.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset['pattern']) {
          result += el.dataset['pattern'];
        } else if (el.tagName === 'BR') {
          result += '\n';
        } else {
          result += el.textContent;
        }
      }
    });
    return result;
  }

  // ── Render: raw → editor HTML ──────────────────────────────

  renderToEditorHtml(raw: string): string {
    if (!raw) return '';
    let html = '';
    let lastIndex = 0;
    const re = makePatternRe();
    let match: RegExpExecArray | null;

    while ((match = re.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index);
      if (before) html += this.esc(before).replace(/\n/g, '<br>');

      const type = match[1] as PatternType;
      const hidden = match[2].trim();
      const label = match[3].trim();

      html += `<span contenteditable="false" class="chip chip-${type}" data-chip="true" data-chip-type="${type}" data-chip-hidden="${this.escAttr(hidden)}" data-chip-label="${this.escAttr(label)}" data-pattern="${this.escAttr(match[0])}"><span class="chip-label">${this.esc(label)}</span></span>`;
      lastIndex = match.index + match[0].length;
    }

    const after = raw.slice(lastIndex);
    if (after) html += this.esc(after).replace(/\n/g, '<br>');

    return html;
  }

  // ── Render: raw → display HTML (with clickable links) ───────

  renderToHtml(raw: string): string {
    if (!raw) return '';
    let html = '';
    let lastIndex = 0;
    const re = makePatternRe();
    let match: RegExpExecArray | null;

    while ((match = re.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index);
      if (before) html += this.esc(before).replace(/\n/g, '<br>');

      const type = match[1] as PatternType;
      const hidden = match[2].trim();
      const label = match[3].trim();

      const href = this.toHref(type, hidden);
      html += `<a href="${this.escAttr(href)}" target="_blank" rel="noopener" class="chip chip-${type} chip-link"><span class="chip-label">${this.esc(label)}</span></a>`;
      lastIndex = match.index + match[0].length;
    }

    const after = raw.slice(lastIndex);
    if (after) html += this.esc(after).replace(/\n/g, '<br>');

    return html;
  }

  // ── URL/Link Generation ────────────────────────────────────

  private toHref(type: PatternType, hidden: string): string {
    switch (type) {
      case 'url': return hidden;
      case 'maps': return hidden;
      case 'email': return `mailto:${hidden}`;
      case 'whatsapp': return `https://wa.me/${hidden.replace(/\D/g, '')}`;
    }
  }

  // ── Cursor & Selection ─────────────────────────────────────

  private placeCursorAtEnd() {
    const el = this.editorEl?.nativeElement;
    if (!el) return;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  private getCaretCoordinates(): { top: number; left: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0).cloneRange();
    let rects = range.getClientRects();

    if (rects.length > 0) {
      return {
        top: rects[0].bottom,
        left: rects[0].left,
      };
    }

    const editorRect = this.editorEl.nativeElement.getBoundingClientRect();
    return { top: editorRect.top, left: editorRect.left };
  }

  // ── HTML Escaping ──────────────────────────────────────────

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Document Click Handler ─────────────────────────────────

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent) {
    if (!this.popupSvc.isOpen()) return;
    const target = event.target as HTMLElement;
    const isPopover = target.closest('[data-rich-popover]');
    const isToolbarBtn = target.closest('.toolbar-btn');
    if (!isPopover && !isToolbarBtn) {
      this.popupSvc.close();
    }
  }
}
